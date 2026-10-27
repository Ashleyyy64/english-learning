# english-learning 生产环境上线流程文档

> 项目仓库：<https://github.com/Ashleyyy64/english-learning>  
> 目标服务器：Ubuntu 22.04 64 位 · 2 核 vCPU · 4 GiB 内存  
> 目标：将 Web 端上线，直到能通过域名 / IP 正常访问网站  
> 技术栈：Next.js 15 + React 19 + Prisma + PostgreSQL + PM2 + Nginx + edge-tts

---

## 目录

- [〇、上线前准备（本地）](#〇上线前准备本地)
- [一、服务器初始化](#一服务器初始化)
- [二、安装运行时依赖](#二安装运行时依赖)
- [三、创建部署用户与目录](#三创建部署用户与目录)
- [四、配置 PostgreSQL](#四配置-postgresql)
- [五、拉取代码并配置环境变量](#五拉取代码并配置环境变量)
- [六、安装依赖、建库、导入词库、构建](#六安装依赖建库导入词库构建)
- [七、进程守护（PM2）](#七进程守护pm2)
- [八、反向代理（Nginx）](#八反向代理nginx)
- [九、防火墙与端口开放](#九防火墙与端口开放)
- [十、最终访问验证](#十最终访问验证)
- [十一、后续迭代与发布流程](#十一后续迭代与发布流程)
- [十二、常见问题排查](#十二常见问题排查)

---

## 〇、上线前准备（本地）

在开始操作服务器之前，先在本地确认三件事，避免上线中途才发现问题。

### 1. 确认代码已推送到 GitHub

```bash
# 在本地项目目录执行
git status
git log --oneline -3
git remote -v
```

- 预期输出：工作区干净（`nothing to commit, working tree clean`），`origin` 指向 `https://github.com/Ashleyyy64/english-learning.git`。
- 原因：服务器是通过 `git clone` 拉代码，本地未提交 / 未推送的改动不会出现在服务器上。

### 2. 确认词书数据已入库（重要）

```bash
git ls-files dictionary-data/ | wc -l
```

- 预期输出：`8`（`book.csv`、`word.csv`、`word_translation.csv`、`ecdict.csv`、`ecdict.translations.tsv`、`relation_book_word.zip`、`LICENSE`、`README.md`）。
- 原因：本项目词书数据已纳入 Git 管理，服务器 `git clone` 后即可直接导入，**无需再单独 clone 第三方词库仓库**，也无需在服务器上重新执行 `build-ecdict-translations.py`（ECDICT 释义产物 `ecdict.translations.tsv` 已在库中）。

### 3. 准备服务器信息

| 项        | 说明                           |
| -------- | ---------------------------- |
| 公网 IP    | 阿里云 ECS 控制台查看                |
| SSH 登录凭据 | root 密码或密钥                   |
| 域名（可选）   | 若用域名访问，需已完成备案并解析到该 IP        |
| 安全组      | 确保已放行 22 / 80 / 443 端口（见第九节） |

---

## 一、服务器初始化

### 1.1 通过 SSH 登录服务器

在你的**本地电脑**（Windows 可用 PowerShell、CMD、Windows Terminal，或 Git Bash）执行：

```bash
ssh root@<你的公网IP>
```

- 首次连接会提示确认指纹，输入 `yes`。
- 预期输出：进入 `root@主机名:~#` 提示符。
- 作用：后续所有服务器操作都从这里开始。

### 1.2 更新系统软件包

```bash
apt update && apt upgrade -y
```

- 作用：更新软件源索引并升级已有软件，确保后续安装的依赖是最新且安全的。
- 预期输出：大量包下载/升级日志，最后回到命令提示符。

### 1.3 安装基础工具

```bash
apt install -y curl git unzip build-essential
```

| 工具                | 用途                                  |
| ----------------- | ----------------------------------- |
| `curl`            | 下载文件、测试接口                           |
| `git`             | 拉取代码                                |
| `unzip`           | 解压 `relation_book_word.zip`（词书导入需要） |
| `build-essential` | gcc/make 等编译工具，供部分 npm 原生依赖编译使用     |

- 预期输出：安装完成，`git --version`、`unzip -v` 可正常输出版本。

### 1.4 确认硬件资源

```bash
free -h
nproc
df -h /
```

- 预期输出：内存约 `4.0Gi`、CPU 核心 `2`、根分区有足够空间（项目含词书数据约 100+ MB，系统盘建议 ≥ 20 GB）。
- 作用：确认与目标规格一致，并为后续可能的内存调优提供依据。

---

## 二、安装运行时依赖

### 2.1 安装 Node.js 20 LTS

Next.js 15 要求 Node.js ≥ 18.18，推荐使用 20 LTS（稳定、长期支持）。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

验证：

```bash
node -v
npm -v
```

- 预期输出：`v20.x.x`、`10.x.x`。

### 2.2 安装 Python3 + pip（供 edge-tts 使用）

本项目单词发音由后端调用 Python 的 edge-tts 合成，服务器必须安装 Python。

```bash
apt install -y python3 python3-pip python3-venv
```

- 预期输出：`python3 --version` 显示 `Python 3.10.x`（Ubuntu 22.04 自带版本）。

### 2.3 安装 edge-tts（在隔离虚拟环境中）

推荐使用虚拟环境安装，避免污染系统 Python，也避免与系统包的版本冲突：

```bash
# 创建并激活虚拟环境（放在项目无关的固定位置）
python3 -m venv /opt/lingua-tts-venv
/opt/lingua-tts-venv/bin/pip install --upgrade pip
/opt/lingua-tts-venv/bin/pip install edge-tts
```

验证：

```bash
/opt/lingua-tts-venv/bin/python -c "import edge_tts; print('edge-tts ok')"
```

- 预期输出：`edge-tts ok`。
- 作用：`PYTHON_BIN` 环境变量会指向这个虚拟环境里的 Python（见第五节），TTS 合成命令才能正确执行。

> **为什么用虚拟环境而不是系统级 `pip install`**：Ubuntu 22.04 默认禁止用 pip 直接往系统 Python 装包（PEP 668），直接 `pip install edge-tts` 会报 `externally-managed-environment` 错误。虚拟环境是最干净、最不容易出错的方案。

### 2.4 安装 PostgreSQL 15

```bash
apt install -y postgresql postgresql-contrib
```

验证：

```bash
psql --version
systemctl status postgresql --no-pager
```

- 预期输出：`psql (PostgreSQL) 15.x`，服务状态为 `active (running)`。
- 作用：多用户并发场景下，PostgreSQL 替代 SQLite，避免并发写锁问题（项目 schema 已配置为 PostgreSQL）。

### 2.5 安装 Nginx

```bash
apt install -y nginx
```

验证：

```bash
nginx -v
systemctl status nginx --no-pager
```

- 预期输出：`nginx/1.18.x`，服务状态 `active (running)`。

### 2.6 安装 PM2（全局）

```bash
npm install -g pm2
```

验证：

```bash
pm2 -v
```

- 预期输出：版本号（如 `5.x.x`）。
- 作用：进程守护，实现崩溃自动重启、日志管理、开机自启。

---

## 三、创建部署用户与目录

> 不推荐用 `root` 直接跑应用进程，权限过大、误操作风险高。创建专用低权限用户更安全。

### 3.1 创建部署用户

```bash
adduser --disabled-password --gecos "" lingua
usermod -aG sudo lingua
```

- `--disabled-password`：不设置密码（通过 root 或 sudo 操作）。
- 作用：创建 `lingua` 用户并加入 `sudo` 组，后续用它部署。

### 3.2 创建应用目录

```bash
mkdir -p /opt/lingua
chown lingua:lingua /opt/lingua
```

- 作用：`/opt/lingua` 作为应用根目录，属主为 `lingua` 用户。
- 预期输出：无报错，`ls -ld /opt/lingua` 显示属主为 `lingua`。

### 3.3 切换到部署用户

后续所有「拉代码、安装依赖、构建、启动」操作都在 `lingua` 用户下执行：

```bash
sudo -iu lingua
```

- 预期输出：提示符变为 `lingua@主机名:~$`，当前目录为 `/home/lingua`。
- 作用：应用进程与文件均归属 `lingua` 用户，避免 root 权限污染。

> 本文档后续章节，除非特别标注，**均默认在 `lingua` 用户下执行**。

---

## 四、配置 PostgreSQL

### 4.1 进入 psql

以下命令需要 PostgreSQL 超级用户权限，用 `sudo -u postgres` 方式执行：

```bash
sudo -u postgres psql
```

- 预期输出：`postgres=#` 提示符。

### 4.2 创建数据库与用户

在 `psql` 内执行（**把 `<你的强密码>` 换成随机强密码**）：

```sql
CREATE USER lingua WITH PASSWORD '2004060byy..';
CREATE DATABASE lingua OWNER lingua;
GRANT ALL PRIVILEGES ON DATABASE lingua TO lingua;
ALTER USER lingua CREATEDB;
\q
```

- 作用：
  - `CREATE USER` 创建数据库账号（与应用部署用户同名，便于区分）。
  - `CREATE DATABASE ... OWNER` 创建 `lingua` 库并归属该账号。
  - `GRANT ALL` 授权该库的全部权限。
  - `ALTER USER ... CREATEDB` 授予建库权限（Prisma 迁移 `migrate dev` 需要 shadow database；生产用 `migrate deploy` 不需要，但提前授予可省去后续麻烦）。
- 预期输出：每行 `CREATE ROLE` / `CREATE DATABASE` / `ALTER ROLE`，最后 `\q` 退出。

### 4.3 验证连接

```bash
psql "postgresql://lingua:20040604byy..@localhost:5432/lingua" -c "SELECT version();"
```

- 预期输出：返回 PostgreSQL 版本信息。
- 作用：确认账号、密码、库名三者都能连上，这是应用能否启动的关键前提。

---

## 五、拉取代码并配置环境变量

### 5.1 拉取代码

确保当前在 `lingua` 用户下、位于 `/home/lingua`，然后：

```bash
cd /opt/lingua
git clone https://github.com/Ashleyyy64/english-learning.git .
```

> 注意末尾的 `.`，表示把仓库内容克隆到当前目录（`/opt/lingua`），而不是新建子目录。

- 预期输出：`Cloning into '.'...`，结束后 `ls` 能看到 `app/`、`components/`、`prisma/`、`dictionary-data/`、`package.json` 等。
- 作用：获取最新代码与词书数据。

### 5.2 确认关键文件就位

```bash
ls -lh dictionary-data/ecdict.translations.tsv dictionary-data/relation_book_word.zip prisma/schema.prisma
```

- 预期输出：三个文件均存在且大小正常（tsv 约 33 MB、zip 约 10 MB）。
- 作用：确认词书数据与 ECDICT 释义产物完整，导入脚本能直接运行。

### 5.3 创建环境变量文件 `.env`

```bash
cd /opt/lingua
cat > .env <<'EOF'
DATABASE_URL="postgresql://lingua:20040604byy..@localhost:5432/lingua?schema=public"
JWT_SECRET="Um4zFHyasxgM8lQSFTxO/lrsdsRleJSKhAE0cr5L1AkGRMT8kTZai33UYdEvCBap"
PYTHON_BIN="/opt/lingua-tts-venv/bin/python"
EOF
```

- 逐项说明：
  - `DATABASE_URL`：与第四节创建的数据库账号密码一致，`?schema=public` 指定默认 schema。
  - `JWT_SECRET`：签名密钥，**必须用强随机字符串**，见下方生成命令。
  - `PYTHON_BIN`：指向第二节创建的 edge-tts 虚拟环境里的 Python，TTS 接口靠它合成发音。

生成强随机 JWT 密钥：

```bash
openssl rand -base64 48
```

- 把输出的字符串整段粘贴到 `JWT_SECRET` 引号内。
- 预期输出：`.env` 文件已创建，`cat .env` 能看到三项配置。

> **安全提示**：`.env` 已被 `.gitignore` 排除，不会进入版本库，密码与密钥只存在于服务器本地。

---

## 六、安装依赖、建库、导入词库、构建

### 6.1 安装 npm 依赖

```bash
cd /opt/lingua
npm install
```

- 作用：安装项目依赖，`postinstall` 会自动执行 `prisma generate` 生成 Prisma Client。
- 预期输出：依赖安装完成，最后有 `added xxx packages` 或 `up to date`；若看到 `Prisma schema loaded` 等字样说明 Client 已生成。
- 耗时：约 1–3 分钟。

### 6.2 创建数据库表结构

```bash
npx prisma db push --skip-generate
```

- 作用：根据 `prisma/schema.prisma` 在 PostgreSQL 中创建表（当前项目用 `db push` 方式管理表结构）。
- 预期输出：`Your database is now in sync with your schema.` 或列出已创建的表。

### 6.3 写入种子数据（演示账号）

```bash
npm run db:seed
```

- 作用：写入演示账号（`teacher`/`alex`/`mia`）与预置邀请码 `LINGUA01`，用于首次登录验证。
- 预期输出：`Seed 完成：` 及账号清单。

> **上线安全提示**：种子账号密码均为 `123456`。**正式对外提供服务前，务必修改或删除这些演示账号**（见第十二节）。

### 6.4 导入词书数据

```bash
npm run db:import
```

- 作用：读取 `dictionary-data/` 下的 CSV 与 ECDICT 释义，写入约 7 万单词、583 本词书、100 万条书词关系。
- 关键细节：脚本会自动解压 `relation_book_word.zip`（依赖 `unzip`，已在第一步安装）。
- 预期输出：先打印 `解析完成：词书 583、单词 70164、关系 ...`，随后 `✅ 导入完成：词书 583、单词 70164、关系 ...`。
- 耗时：约几十秒到 1 分钟。

### 6.5 生产构建

```bash
npm run build
```

- 作用：执行 Next.js 生产构建，产出 `.next/` 产物。
- 预期输出：构建成功，输出各路由类型（`ƒ (Dynamic)` / `○ (Static)`）与 `Compiled successfully`。
- 耗时：约 1–2 分钟。
- 若 4 GiB 内存下仍报内存不足（少见），可临时限制堆内存重试：`NODE_OPTIONS="--max-old-space-size=2048" npm run build`。

---

## 七、进程守护（PM2）

### 7.1 启动应用

```bash
cd /opt/lingua
pm2 start ecosystem.config.js
```

- 作用：按 `ecosystem.config.js` 配置以 `next start` 启动应用，监听 3000 端口。
- 预期输出：显示进程 `lingua` 状态为 `online`。

### 7.2 查看状态与日志

```bash
pm2 status
pm2 logs lingua --lines 30
```

- 预期输出：`status` 中 `lingua` 为 `online`，日志无报错。

### 7.3 设置开机自启

```bash
pm2 save
pm2 startup systemd
```

- `pm2 save`：保存当前进程列表，供重启后恢复。
- `pm2 startup systemd`：会输出一条需要以 `sudo` 执行的命令（形如 `sudo env PATH=... pm2 startup systemd -u lingua --hp /home/lingua`），**复制并执行它**。
- 作用：服务器重启后自动拉起应用。

### 7.4 验证本机服务

```bash
curl -I http://localhost:3000
```

- 预期输出：`HTTP/1.1 200 OK`（或 307/301 重定向到登录页，均属正常）。
- 作用：确认 Next 应用已在本机 3000 端口正常响应，之后再由 Nginx 对外转发。

---

## 八、反向代理（Nginx）

> Nginx 负责接收 80/443 端口的公网请求并转发到本机 3000 端口，同时可承担 HTTPS、静态缓存等职责。

### 8.1 创建站点配置

用 `lingua` 用户先写配置，再交给 root 放到 Nginx 目录。以下以 root 身份执行：

```bash
sudo -u root bash -c 'cat > /etc/nginx/sites-available/lingua <<EOF
server {
    listen 80;
    server_name 121.199.50.237;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/tts {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_cache_valid 200 365d;
    }
}
EOF'
```

> 项目根目录已有 `nginx.conf.example` 作为参考，此处直接生成到服务器标准位置。

- 逐项说明：
  - `listen 80`：先以 HTTP 监听，HTTPS 后续用 certbot 自动追加。
  - `server_name`：填你的域名；若暂无域名，直接填公网 IP。
  - `client_max_body_size 20m`：预留文件上传能力。
  - `proxy_pass http://127.0.0.1:3000`：转发到 Next 应用。
  - `/api/tts` 单独一个 location：TTS 音频请求走独立缓存策略（音频不可变，可长期缓存）。

### 8.2 启用站点并重载

```bash
ln -s /etc/nginx/sites-available/lingua /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```


- `ln -s`：软链到 `sites-enabled` 使配置生效。
- `nginx -t`：校验配置语法。
- 预期输出：`nginx: configuration file ... test is successful`，`systemctl reload` 无报错。

### 8.3 （可选）配置 HTTPS

若有备案域名，用 certbot 一键申请免费证书：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d www.iashley.cn
```

- 作用：自动申请 Let's Encrypt 证书、改写 Nginx 配置、配置自动续期。
- 预期输出：提示选择是否强制跳转 HTTPS（建议选 2，即强制跳转），成功后显示证书路径。
- 若暂时只有 IP、无域名，可跳过本节，先以 HTTP 访问验证。

## 十、最终访问验证

### 10.1 本机 + 端口连通性检查

```bash
ss -tlnp | grep -E ':(80|443|3000)'
```

- 预期输出：能看到 `3000`（Next）、`80`（Nginx）在监听。

### 10.2 浏览器访问

在本地浏览器打开：

- 有域名：`http://<你的域名>`（或配置了 HTTPS 后 `https://<你的域名>`）
- 无域名：`http://<你的公网IP>`
- 预期结果：出现登录页。
- 用种子账号登录验证：教师 `teacher / 123456`、学生 `alex / 123456`，能正常进入对应工作台即视为上线成功。

### 10.3 核心功能冒烟验证

| 验证项  | 操作               | 预期               |
| ---- | ---------------- | ---------------- |
| 登录   | 账号密码登录           | 跳转对应角色工作台        |
| 词书   | 背单词 → 选择词书       | 六大分类正常显示         |
| 发音   | 点单词旁小喇叭          | 播放单词发音（TTS 链路正常） |
| 学习闭环 | 学前检测 → 识记 → 学后检测 | 状态正常流转           |

- 作用：确认数据库、词库、TTS 三块核心链路在服务器上都正常。

---

## 十一、后续迭代与发布流程

> 本节说明：本地新增功能、支持多端后，代码变动如何同步到服务器并重新上线。

### 11.1 推荐的整体发布策略

采用「**Git 作为唯一事实源 + 服务器 pull + 重新构建 + 平滑重启**」的流程，核心原则：

1. **一切改动先提交 Git**，服务器只从 Git 拉取，保证可追溯、可回滚。
2. **构建产物可替换**：`npm run build` 覆盖 `.next/`，旧版本进程仍在运行，直到 `pm2 reload` 才切换，实现尽量不中断。
3. **回滚 = 回退 Git 版本 + 重新构建**，简单可靠。

### 11.2 标准发布流程（每次更新都照此做）

#### 步骤 1：本地提交并推送

```bash
# 本地项目目录
git add .
git commit -m "feat: 描述本次改动"
git push origin main
```

- 作用：把改动固化到 Git，成为可追溯、可回滚的版本。
- 建议：提交信息遵循 `feat:` / `fix:` / `refactor:` / `chore:` 前缀，方便回溯。

#### 步骤 2：登录服务器，切换到部署用户

```bash
ssh root@<你的公网IP>
sudo -iu lingua
```

#### 步骤 3：拉取最新代码

```bash
cd /opt/lingua
git pull origin main
```

- 预期输出：显示 `Fast-forward` 或文件变更列表。

#### 步骤 4：安装新依赖（如有变动）并迁移数据库（如有变动）

```bash
npm install
npx prisma db push --skip-generate   # 仅当 schema.prisma 有变更时执行
```

- 作用：同步依赖与表结构。若本次改动不涉及依赖/schema，这两步可跳过。

#### 步骤 5：重新构建

```bash
npm run build
```

- 作用：生成新的生产产物。

#### 步骤 6：平滑重启

```bash
pm2 reload lingua
```

- 作用：`pm2 reload` 会优雅地以新产物重启进程，尽量不中断服务（比 `pm2 restart` 更平滑）。
- 预期输出：`[PM2] Applying action reloadProcessId on app [lingua]`，状态回到 `online`。

#### 步骤 7：验证

```bash
pm2 status
curl -I http://localhost:3000
```

- 作用：确认进程在线、服务正常响应，再宣布发布完成。

### 11.3 回滚流程（出问题时的退路）

```bash
cd /opt/lingua

# 1. 查看历史提交，找到上一个稳定版本
git log --oneline -5

# 2. 回退到指定提交（把 <commit-id> 换成目标版本）
git checkout <commit-id> -- .

# 3. 重新安装依赖并构建（确保与代码版本一致）
npm install
npm run build

# 4. 平滑重启
pm2 reload lingua
```

- 作用：用 Git 版本号精确定位并回退到上一个可用状态，全程可追溯。
- 更推荐的长期做法：用 Git 标签（tag）标记每次上线版本，如 `git tag v1.2.0 && git push --tags`，回滚时 `git checkout v1.2.0 -- .` 更直观。

### 11.4 平滑发布与零停机建议

| 目标    | 建议做法                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 尽量不中断 | 始终用 `pm2 reload` 而非 `restart`；单实例下 reload 已足够平滑                                                      |
| 真正零停机 | 用户量上来后可升级为 `ecosystem.config.js` 多实例（`instances: 2` + `exec_mode: cluster`），PM2 会逐实例滚动重启，旧实例服务、新实例接管 |
| 可追溯   | 每次上线打 Git tag，提交信息写清变更点                                                                              |
| 可回滚   | 保留可回退的 Git 版本 + 数据库每日备份（见下）                                                                          |

### 11.5 数据库备份（务必配置）

上线后第一时间配置每日自动备份：

```bash
crontab -e
# 添加以下两行（注意：crontab 在哪个用户下配，就用哪个用户执行 pg_dump）
0 3 * * * pg_dump "postgresql://lingua:<你的强密码>@localhost:5432/lingua" | gzip > /var/backups/lingua-$(date +\%F).sql.gz
0 4 * * * find /var/backups -name 'lingua-*.sql.gz' -mtime +14 -delete
```

- 作用：每日凌晨 3 点备份，4 点清理 14 天前的旧备份。
- 前置：先创建备份目录 `sudo mkdir -p /var/backups && sudo chown lingua /var/backups`。

### 11.6 多端上线后的额外注意

- 当 App / 小程序接入同一套 API 时，**接口层改动会影响多端**，发布前需：
  1. 确认 API 变更是向后兼容的（新增字段优于修改/删除字段）。
  2. 涉及鉴权、数据结构变更时，先迁移数据库再发布代码。
  3. 建立简单的接口文档 / 类型定义，供多端同步对齐。

---

## 十二、常见问题排查

| 问题        | 排查方式                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------- |
| 网站打不开     | `curl -I http://localhost:3000` 看本机是否正常 → 检查 Nginx `systemctl status nginx` → 检查安全组/UFW 是否放行 80/443 |
| 500 错误    | `pm2 logs lingua --err --lines 50` 查看错误日志                                                           |
| 连不上数据库    | `psql "postgresql://lingua:<密码>@localhost:5432/lingua" -c "SELECT 1"` 验证连接串                         |
| TTS 无声    | `PYTHON_BIN` 是否正确指向虚拟环境；`/opt/lingua-tts-venv/bin/python -c "import edge_tts"` 验证                   |
| 词书导入失败    | 确认 `dictionary-data/ecdict.translations.tsv` 与 `relation_book_word.zip` 存在；确认已安装 `unzip`            |
| 构建内存不足    | `NODE_OPTIONS="--max-old-space-size=2048" npm run build`                                            |
| 服务器重启后网站挂 | `pm2 startup` 是否执行成功；`systemctl status pm2-lingua` 检查                                               |
| 端口不通      | `ss -tlnp` 确认监听；对照安全组入方向规则                                                                          |

---

## 附：上线前安全清单（对外服务前必查）

- [ ] 删除或修改种子演示账号（`teacher`/`alex`/`mia`，密码 `123456`）
- [ ] 确认 `.env` 中 `JWT_SECRET` 为强随机值、`DATABASE_URL` 密码为强密码
- [ ] 配置数据库每日备份
- [ ] 配置 HTTPS（有域名时）
- [ ] 确认安全组未暴露 3000 端口
- [ ] 配置登录失败限流（当前代码暂无，建议后续补充）

---

*文档结束。照以上步骤执行，即可完成从空服务器到可通过域名/IP 正常访问的完整上线。*
