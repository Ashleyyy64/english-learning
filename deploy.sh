#!/usr/bin/env bash
# Lingua 一键部署脚本（Ubuntu 22.04 裸机 + PostgreSQL + PM2）
# 用法：bash deploy.sh
# 需在项目根目录执行，且 .env 已配置好（DATABASE_URL 指向 PostgreSQL）
set -euo pipefail

echo "=============================================="
echo "  Lingua 部署脚本 (Ubuntu 22.04 + PostgreSQL)"
echo "=============================================="

# 0. 检查 .env
if [ ! -f .env ]; then
  echo "[错误] 未找到 .env，请先创建并配置："
  echo "  DATABASE_URL=postgresql://lingua:密码@localhost:5432/lingua?schema=public"
  echo "  JWT_SECRET=<强随机值>  （openssl rand -base64 48）"
  echo "  PYTHON_BIN=python3"
  exit 1
fi

# 1. 检查运行时
echo "[1/6] 检查运行时..."
for cmd in node python3 psql; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "缺少 $cmd，请先安装"; exit 1; }
done
echo "  node: $(node -v)"
echo "  python3: $(python3 --version)"
echo "  psql: $(psql --version)"

# 2. 安装 edge-tts
echo "[2/6] 安装 edge-tts..."
python3 -m pip install --user edge-tts==7.2.8 2>/dev/null || pip3 install edge-tts==7.2.8

# 3. 安装 npm 依赖 + 生成 Prisma Client
echo "[3/6] 安装依赖..."
npm ci || npm install

# 4. 初始化数据库（db push 建表 + seed 种子数据）
echo "[4/6] 初始化数据库..."
npx prisma db push --skip-generate
# 仅当数据库为空时写种子（避免覆盖已有数据）
if [ "$(psql "$DATABASE_URL" -tAc 'SELECT COUNT(*) FROM "User"' 2>/dev/null || echo 0)" = "0" ]; then
  npm run db:seed
fi

# 5. 导入词库（如 dictionary-data 已上传）
echo "[5/6] 导入词库..."
if [ -d dictionary-data ]; then
  npm run db:import
else
  echo "  未找到 dictionary-data/，跳过词库导入（请先上传词典数据）"
fi

# 6. 构建
echo "[6/6] 构建..."
npm run build

echo "=============================================="
echo "  构建完成！"
echo ""
echo "  启动（PM2 守护 + 开机自启）："
echo "    npm i -g pm2"
echo "    pm2 start ecosystem.config.js"
echo "    pm2 save"
echo "    pm2 startup systemd   # 按提示执行输出命令"
echo ""
echo "  反向代理 + HTTPS：参考 nginx.conf.example 与 DEPLOY.md"
echo "=============================================="
