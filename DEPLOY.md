# Lingua 英语学习平台 · 部署手册

> 目标环境：阿里云 ECS · Ubuntu 22.04 · 2GB 内存 · 裸机部署（无 Docker）
> 技术栈：Next.js 15 + React 19 + Prisma + **PostgreSQL** + PM2 + Nginx + edge-tts

---

## 一、方案总览

| 组件 | 选型 | 说明 |
|------|------|------|
| 操作系统 | Ubuntu 22.04 LTS | 已从 Windows Server 重装 |
| 数据库 | PostgreSQL 15 | 已从 SQLite 迁移，解决并发写锁 |
| 运行时 | Node.js 20 LTS | Next.js 15 要求 |
| TTS | Python3 + edge-tts 7.2.8 | 微软神经网络音色，磁盘缓存 + 常驻合成进程 |
| 进程守护 | PM2 | 崩溃重启 + 开机自启（systemd） |
| 反向代理 | Nginx | 80/443 → 3000 |
| HTTPS | certbot (Let's Encrypt) | 免费证书 + 自动续期 |

> **内存说明**：2GB 内存裸机可稳定运行，但需给 PostgreSQL 做低内存调优（见第六节），并用 swap 兜底 `next build`。

---

## 二、重装系统（阿里云控制台）

1. 阿里云控制台 → ECS 实例 → 更多 → **云盘与镜像 → 更换操作系统**
2. 选择 **Ubuntu 22.04 64 位**
3. 重装后，系统盘数据会清空，原 Windows Server 上的数据需提前备份（本项目代码和 dev.db 在本地，无需备份服务器）
4. 用 SSH 登录：`ssh root@你的公网IP`

---

## 三、安装运行时依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 Python3 + pip
apt install -y python3 python3-pip python3-venv

# 安装 PostgreSQL 15
apt install -y postgresql postgresql-contrib

# 安装 Nginx
apt install -y nginx

# 安装 PM2
npm install -g pm2

# 验证
node -v      # v20.x
python3 --version
psql --version
nginx -v
```

---

## 四、配置 PostgreSQL

```bash
# 切换到 postgres 用户
sudo -u postgres psql
```

在 psql 里执行：

```sql
-- 创建数据库和用户（密码改成你自己的强密码）
CREATE USER lingua WITH PASSWORD '你的强密码';
CREATE DATABASE lingua OWNER lingua;
GRANT ALL PRIVILEGES ON DATABASE lingua TO lingua;
\q
```

> 如果用 Prisma 的 shadow database（migrate dev），还需授予 `CREATEDB`：
> ```sql
> ALTER USER lingua CREATEDB;
> ```

---

## 五、上传代码 + 配置环境变量

### 5.1 上传代码

项目当前**不是 git 仓库**，用 `scp`/`rsync` 上传（在本地 Windows 的 Git Bash 或 WSL 执行）：

```bash
# 排除 node_modules、.next、dictionary-data（238MB 词书数据可后传）
rsync -av --exclude node_modules --exclude .next --exclude dictionary-data \
  ./ root@你的IP:/opt/lingua/
```

### 5.2 上传词典数据（用于 db:import 导入词库）

```bash
rsync -av ./dictionary-data/ root@你的IP:/opt/lingua/dictionary-data/
```

### 5.3 配置 .env

在服务器 `/opt/lingua/.env` 创建。完整模板见 `.env.production.example`，最小必填项：

```bash
cd /opt/lingua
cp .env.production.example .env
# 然后编辑 .env，至少填：DATABASE_URL、JWT_SECRET、APP_BASE_URL
```

> 生成密钥：`openssl rand -base64 48`（JWT_SECRET）、`openssl rand -base64 32`（CODES_PEPPER / OAUTH_ENCRYPTION_KEY）

认证相关新增配置项说明：

| 变量 | 必填 | 说明 |
|------|------|------|
| `CODES_PEPPER` | 建议 | 验证码哈希加盐，缺省回退 JWT_SECRET |
| `OAUTH_ENCRYPTION_KEY` | 建议 | OAuth 令牌加密密钥，缺省回退 JWT_SECRET |
| `APP_BASE_URL` | OAuth 时必填 | 回调地址拼接基础 |
| `SMTP_HOST` 等 | 邮件验证码时 | 不配置则邮件验证码不可用（开发环境回退控制台） |
| `SMS_PROVIDER` 等 | 短信验证码时 | `console`=控制台兜底，`tencent`=腾讯云短信 |
| `WECHAT_*` / `GITHUB_*` | 第三方登录时 | 未配置时对应登录入口返回「未配置」提示 |

> 生成 JWT 密钥：`openssl rand -base64 48`

---

## 六、低内存调优（2GB 必须做）

### 6.1 配置 swap（构建时兜底）

```bash
# 创建 2GB swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
# 持久化
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 6.2 调低 PostgreSQL 内存占用

编辑 `/etc/postgresql/15/main/postgresql.conf`：

```ini
shared_buffers = 128MB        # 默认 128MB，保持即可
effective_cache_size = 512MB
work_mem = 4MB                # 降低单查询内存
maintenance_work_mem = 64MB
max_connections = 50          # 减少连接数省内存
```

重启生效：

```bash
systemctl restart postgresql
```

### 6.3 Next.js 构建限制内存

2GB 机器 `next build` 可能 OOM，用 swap 兜底即可（已配 2GB swap）。如仍失败，可：

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```

---

## 七、建库 + 导入词库 + 构建

```bash
cd /opt/lingua

# 1. 安装依赖（自动 prisma generate）
npm install

# 2. 建表（含认证新增的 Session / VerificationCode / OAuthAccount 表，
#    以及 User 新增的 email/phone/status/failedAttempts/lockedUntil 等字段）
npx prisma db push --skip-generate

# 3. 种子数据（演示账号 + 邀请码）
npm run db:seed

# 4. 导入词库（588 词书 / 7 万单词 / 100 万关系，约几十秒）
npm run db:import

# 5. 生产构建
npm run build
```

> **升级说明**：本次认证升级后，旧版 JWT（不含会话 id）将无法通过校验，所有用户需重新登录一次；已有用户数据不受影响。新注册用户走「邮箱/手机号 + 验证码」流程，旧用户名密码用户仍可按原方式登录。

---

## 八、启动 + 开机自启

```bash
cd /opt/lingua

# 启动
pm2 start ecosystem.config.js
pm2 save

# 开机自启（systemd）
pm2 startup systemd
# 执行上面命令输出的 sudo 命令
```

验证：`curl http://localhost:3000` 应返回登录页 HTML。

---

## 九、Nginx 反向代理 + HTTPS

### 9.1 配置 Nginx

把 `nginx.conf.example` 复制到 `/etc/nginx/sites-available/lingua`，改域名，然后：

```bash
cp nginx.conf.example /etc/nginx/sites-available/lingua
ln -s /etc/nginx/sites-available/lingua /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 9.2 配置 HTTPS（certbot）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

certbot 会自动申请证书、配置 Nginx、设置自动续期。

---

## 十、域名解析 + 安全组

1. **域名解析**：阿里云云解析 DNS → 添加 A 记录，主机记录 `@`/`www`，值填 ECS 公网 IP
2. **安全组放行**：阿里云 ECS 安全组放行 80、443 端口
3. 确认域名已备案（国内服务器访问 80/443 需备案）

---

## 十一、数据库备份（cron）

```bash
# 每日凌晨 3 点备份
crontab -e
# 添加：
0 3 * * * pg_dump lingua | gzip > /var/backups/lingua-$(date +\%F).sql.gz
# 保留最近 14 天
0 4 * * * find /var/backups -name 'lingua-*.sql.gz' -mtime +14 -delete
```

---

## 十二、常见问题

| 问题 | 排查 |
|------|------|
| 构建 OOM | 确认 swap 已生效（`free -h` 看 swap 非 0） |
| TTS 无声 | `python3 -c "import edge_tts"` 验证；检查 `PYTHON_BIN` |
| TTS 变慢/超时 | 常驻合成进程被 OOM 杀掉后会自动重建；`pm2 logs lingua --err` 看 `[tts-server]` 报错；确认 `.tts-cache/` 可写 |
| 连不上数据库 | `psql "$DATABASE_URL" -c 'SELECT 1'` 验证连接串 |
| 端口不通 | 检查安全组 + Nginx 状态 + `ss -tlnp` |
| 服务器重启后网站挂 | `pm2 startup` 是否配置成功，`systemctl status pm2-root` |

---

## 十三、上线后待办（按优先级）

1. 删除/修改演示账号（seed 里的 teacher/alex/mia 密码都是 `123456`）
2. 配置数据库定期备份（见第十一节）
3. 接入日志监控（PM2 日志 + 可选 uptime 告警）
4. 后续用户量增长后，可加 Nginx 缓存、升级内存、加只读副本
