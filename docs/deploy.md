# SubFlare 部署指南

SubFlare 完全运行在 Cloudflare 上，**免费套餐即可使用**，不需要自己的服务器。

部署有两种方式，任选其一：

| 方式 | 适合谁 | 需要准备 |
|---|---|---|
| [方式一：网页一键部署](#方式一网页一键部署推荐) | 第一次用、不想碰命令行 | Cloudflare 账号 + GitHub 账号 |
| [方式二：命令行一键部署](#方式二命令行一键部署) | 有电脑或服务器、习惯命令行 | Cloudflare 账号 + Cloudflare API Token + 装了 Node.js 22+ 的电脑 |
| [方式三：Docker 自托管](#方式三docker-自托管) | 有自己的服务器 / NAS，不想依赖 Cloudflare | 一台装了 Docker 的机器 |

方式一、二运行在 Cloudflare 上；方式三运行在你自己的机器上，数据保存在本地 SQLite 文件中，功能和生成的配置与 Cloudflare 版完全一致。

部署完成后，请继续看 [部署后：第一次使用](#部署后第一次使用) 和 [绑定自定义域名](#绑定自定义域名国内访问必看)。

> ⚠️ **国内用户必读**：Cloudflare 默认分配的 `*.workers.dev` 域名在中国大陆通常**无法直接访问**。如果你的客户端在国内直连拉取订阅，需要[绑定自己的域名](#绑定自定义域名国内访问必看)。

---

## 准备工作

1. **Cloudflare 账号**：在 <https://dash.cloudflare.com/sign-up> 免费注册。
2. **GitHub 账号**（仅方式一需要）：在 <https://github.com/signup> 免费注册。
3. **准备一个登录令牌**（方式二可以不准备，脚本会自动生成）：这是你登录 SubFlare 后台的唯一密码。
   - 至少 8 位，建议 32 位随机字符，**不要使用示例里的 `change-me-please`**。
   - 生成方法（任选一种）：
     - macOS / Linux 终端：`openssl rand -hex 16`
     - 或者用密码管理器生成一串随机密码
   - 请把它保存好，后面登录要用。

---

## 方式一：网页一键部署（推荐）

### 第 1 步：点击部署按钮

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ProtonClaw/subflare)

点击后会打开 Cloudflare 的部署页面。如果没有登录，先登录 Cloudflare。

### 第 2 步：连接 GitHub

页面会要求你连接 GitHub（或 GitLab）账号并授权。Cloudflare 会把 SubFlare 的代码**复制一份到你自己的 GitHub 账号下**，以后的更新、部署都基于你自己的这份代码。

### 第 3 步：填写配置

部署页面会列出以下几项，**除了登录令牌，其他保持默认即可**：

| 配置项 | 说明 | 怎么填 |
|---|---|---|
| Git 仓库名 | 在你 GitHub 下新建的仓库名 | 默认 `subflare`，可改 |
| Worker 名称 | 决定默认访问地址 `https://<Worker 名称>.<你的子域>.workers.dev` | 默认 `subflare`，可改 |
| `DB`（D1 数据库） | 保存订阅、模板、拉取记录 | 保持默认，会自动新建 |
| `KV`（KV 命名空间） | 缓存生成好的配置 | 保持默认，会自动新建 |
| `SUBFLARE_TOKEN` | **后台登录令牌** | **改成你在准备工作里生成的令牌** |

> 如果你的 GitHub 仓库设置为公开，代码会公开，但令牌**不会**出现在仓库里，它只保存在 Cloudflare 上。

### 第 4 步：创建并部署

点击 **Create and deploy**（创建并部署）。Cloudflare 会自动完成：

1. 创建 D1 数据库和 KV 命名空间；
2. 安装依赖并构建（`npm run build`）；
3. 部署并初始化数据库表（`npm run deploy`）。

整个过程大约 2～5 分钟，可以在页面上看到构建日志。看到部署成功后，页面会显示访问地址，形如：

```text
https://subflare.<你的子域>.workers.dev
```

接下来请跳到 [部署后：第一次使用](#部署后第一次使用)。

### 以后如何更新（网页部署用户）

一键部署创建的是**你自己的独立仓库**（不是 fork），并且已经连接了 Cloudflare 自动构建：**只要你的仓库 `main` 分支有新提交，Cloudflare 就会自动重新部署**，数据库迁移也会自动执行，数据不会丢失。

要获取 SubFlare 的新版本，在电脑上执行：

```bash
git clone https://github.com/<你的 GitHub 用户名>/subflare.git
cd subflare
git remote add upstream https://github.com/ProtonClaw/subflare.git
git pull upstream main
git push origin main
```

如果 `git pull` 提示 `wrangler.jsonc` 有冲突：这是因为一键部署时 Cloudflare 往你的 `wrangler.jsonc` 里写入了你自己的数据库 ID，**冲突时保留你自己的 `database_id` / `id` 那几行**，其余采用新版本即可。

---

## 方式二：命令行一键部署

准备好一个 Cloudflare API Token，一条命令完成全部部署：安装依赖、构建、创建数据库、初始化表、设置登录令牌。**同一条命令重复运行就是更新**，数据和登录令牌都会保留。

### 第 1 步：安装 Node.js 和 Git

- **Node.js 22 或更高版本**：从 <https://nodejs.org/zh-cn> 下载 LTS 版本安装。
- **Git**：从 <https://git-scm.com/downloads> 下载安装。

安装完成后打开终端（Windows 用 PowerShell），确认版本：

```bash
node -v   # 应显示 v22.x.x 或更高
git --version
```

### 第 2 步：创建 Cloudflare API Token

1. 打开 <https://dash.cloudflare.com/profile/api-tokens>，点击 **Create Token**（创建令牌）；
2. 拉到最下面，选择 **Create Custom Token**（创建自定义令牌）→ **Get started**；
3. **Token name** 随便填，比如 `subflare-deploy`；
4. **Permissions**（权限）添加以下 4 行，左边都选 **Account**（账户）：

   | 资源 | 权限 |
   |---|---|
   | Workers Scripts | Edit |
   | D1 | Edit |
   | Workers KV Storage | Edit |
   | Account Settings | Read |

5. **Account Resources**（账户资源）选 **Include → 你的账户**；
6. 点击 **Continue to summary** → **Create Token**，**复制显示的 Token**（只显示一次）。

> 请用 API Token，不要用 Global API Key：Global API Key 拥有整个账号的全部权限，泄露后果严重。

### 第 3 步：下载代码

```bash
git clone https://github.com/ProtonClaw/subflare.git
cd subflare
```

> 国内下载依赖慢，可以先执行 `npm config set registry https://registry.npmmirror.com` 切换到国内镜像。

### 第 4 步：填写配置并部署

在 `subflare` 目录下新建一个名为 **`.env.deploy`** 的文件（注意开头有个点），内容如下：

```ini
# 必填：第 2 步创建的 API Token
CLOUDFLARE_API_TOKEN=粘贴你的 Token
# 可选：后台登录令牌（至少 8 位）。不填则自动生成一个，并在部署完成时显示
# SUBFLARE_TOKEN=
# 可选：只有你的 Cloudflare 登录下有多个账户时才需要，在后台首页右侧可以看到 Account ID
# CLOUDFLARE_ACCOUNT_ID=
```

> `.env.deploy` 已被 git 忽略，不会被提交。把配置写在文件里，也能避免 Token 留在终端历史记录中。

然后执行：

```bash
npm run setup
```

脚本会依次显示 `[1/3] 安装依赖`、`[2/3] 构建并部署`、`[3/3] 设置登录令牌`，整个过程约 1～3 分钟。成功后会输出：

```text
✅ 部署完成
   访问地址：https://subflare.<你的子域>.workers.dev
   登录令牌：xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **登录令牌只在自动生成时显示这一次，请立即保存。**
- 令牌生效需要几十秒，如果马上登录提示 “SUBFLARE_TOKEN 未配置”，等半分钟再试。

### 以后如何更新

```bash
cd subflare
git pull
npm run setup
```

数据库会自动迁移，已有数据不会丢失；没有填写 `SUBFLARE_TOKEN` 时，线上已有的登录令牌保持不变。

### 部署失败怎么办

脚本失败时会给出提示，最常见的原因：

| 报错现象 | 解决方法 |
|---|---|
| 提示权限不足（Authentication error / 10000） | 检查 API Token 是否包含上面 4 项权限，且账户资源选了你的账户 |
| 提示有多个账户（More than one account） | 在 `.env.deploy` 中填写 `CLOUDFLARE_ACCOUNT_ID` |
| 提示需要注册 workers.dev 子域 | 全新账号需要先在网页后台打开一次 **Workers & Pages** 页面，系统会分配子域，然后重新运行 |
| `npm install` 很慢或失败 | 切换国内镜像：`npm config set registry https://registry.npmmirror.com` |

<details>
<summary>进阶：不使用脚本，手动分步执行</summary>

`npm run setup` 本质上只是依次执行下面几步。想弄清楚每一步做了什么，或者想用浏览器授权代替 API Token，可以手动执行：

```bash
npm install
npx wrangler login                       # 浏览器授权登录（已设置 CLOUDFLARE_API_TOKEN 时可跳过）
npm run deploy                           # 构建 → 部署（首次自动创建 D1 和 KV）→ 执行数据库迁移
npx wrangler secret put SUBFLARE_TOKEN   # 按提示粘贴登录令牌
```

交互模式下可能出现的提示：第一次使用 Workers 会要求注册 `workers.dev` 子域，输入一个名字即可；数据库迁移提示 “Ok to proceed?” 时输入 `y`。

</details>

---

## 方式三：Docker 自托管

### 第 1 步：安装 Docker

按照 <https://docs.docker.com/engine/install/> 安装 Docker（自带 `docker compose`）。确认：

```bash
docker --version
docker compose version
```

### 第 2 步：下载代码并设置登录令牌

```bash
git clone https://github.com/ProtonClaw/subflare.git
cd subflare
```

在 `subflare` 目录下新建 `.env` 文件，内容如下：

```ini
# 必填：后台登录令牌（至少 8 位），例如用 openssl rand -hex 16 生成
SUBFLARE_TOKEN=换成你的令牌
# 可选：对外端口，默认 8787
# SUBFLARE_PORT=8787
```

### 第 3 步：启动

```bash
docker compose up -d --build
```

首次需要构建镜像，约 1～3 分钟。完成后检查状态：

```bash
docker compose ps        # STATUS 显示 healthy 即正常
docker compose logs -f   # 查看日志，Ctrl+C 退出
```

浏览器打开 `http://<服务器 IP>:8787`，输入登录令牌即可使用。

### 配置 HTTPS（公网访问强烈建议）

直接用 `http://` 访问时，登录令牌和订阅链接都是明文传输。公网使用请在前面加一层反向代理并启用 HTTPS。

**Caddy**（自动申请证书，最简单）：

```text
sub.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

**Nginx**：必须传递以下请求头，否则登录后的保存操作会被拒绝，拉取记录里的 IP 也会不正确：

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

使用反向代理后，建议把 `docker-compose.yml` 中的端口改为 `"127.0.0.1:8787:8787"`，只允许本机访问。

### 更新

```bash
cd subflare
git pull
docker compose up -d --build
```

启动时会自动执行数据库迁移，数据不会丢失。

### 备份与恢复

最简单的方式是在控制台 **设置 → 备份与恢复** 导出 / 导入 JSON 备份（包含全部订阅和模板，不含拉取记录），Cloudflare 版和 Docker 版之间也可以互相迁移，订阅链接保持不变。

如果要连拉取记录一起完整备份，可以直接复制数据库文件。数据保存在 Docker 数据卷 `subflare_subflare-data` 中（`docker compose down` 不会删除它；`docker compose down -v` **会删除**）。

```bash
# 备份：先停止，避免复制到写了一半的数据
docker compose stop
docker compose cp subflare:/data ./backup-$(date +%F)
docker compose start

# 恢复（第三行修正文件属主，否则会报 readonly database）
docker compose stop
docker compose cp ./backup-2026-01-01/. subflare:/data
docker compose run --rm --no-deps --user root --entrypoint chown subflare -R node:node /data
docker compose start
```

### 与 Cloudflare 版的区别

| | Cloudflare 版 | Docker 版 |
|---|---|---|
| 访问地址 | `*.workers.dev`（国内需绑定域名） | 你的服务器 IP / 域名 |
| 抓取机场订阅的 IP | Cloudflare 的 IP | 你服务器的 IP |
| 拉取记录的地理位置（国家、城市、运营商） | 有 | **没有**，只记录 IP 和客户端 |
| 拉取记录的 IP | Cloudflare 提供 | 优先取反向代理传来的 `X-Real-IP` / `X-Forwarded-For`，否则取连接地址 |
| 数据存储 | Cloudflare D1 | 本地 SQLite 文件 |

> 没有反向代理、直接暴露端口时，客户端可以伪造 `X-Forwarded-For`，拉取记录里的 IP 仅供参考。
>
> 通过 `localhost` 访问时，拉取记录中的 IP 会显示为 Docker 网关地址（如 `172.x.x.1`），属于正常现象。

---

## 部署后：第一次使用

### 1. 登录后台

浏览器打开部署得到的地址（或你绑定的自定义域名），输入登录令牌，点击 **进入控制台**。

### 2. 新建订阅

左侧菜单点击 **新建订阅**，按页面从上到下填写：

1. **订阅来源**：粘贴机场的订阅链接，也可以直接粘贴节点（`ss://`、`vmess://`、`vless://`、`trojan://`、`hysteria2://` 等），链接和节点可以混合，会自动识别。
2. **节点获取方式**：
   - **云端快照**：Cloudflare 定时去机场抓取节点，**可以显示剩余流量和到期时间**，支持节点重命名、删除。推荐优先使用。
   - **客户端拉取**：只生成配置框架，由你的客户端自己去机场拉节点。适合机场屏蔽 Cloudflare、云端快照拉取失败的情况。
3. **规则模板**：决定生成哪些分流组和规则，不确定就选推荐的那个。
4. 点击 **生成订阅**。

### 3. 导入到客户端

保存后进入订阅详情页：

- 点击 **复制链接**，在 Clash Verge / Mihomo Party / Stash 等客户端里“从 URL 导入订阅”；
- 或者点击 **导入 Clash** / **导入 Stash** 一键导入；
- 手机可以直接扫描页面上的二维码。

> 订阅链接里包含访问凭证，**不要分享给他人**。如果泄露，在订阅详情页 **设置** 标签中点击 **重置链接**，旧链接立即失效。

---

## 绑定自定义域名（国内访问必看）

`*.workers.dev` 在中国大陆通常无法访问，绑定自己的域名可以解决。要求：**这个域名已经托管在 Cloudflare**（在 Cloudflare 后台添加站点，并把域名的 NS 改成 Cloudflare 提供的地址）。

1. 打开 Cloudflare 后台 <https://dash.cloudflare.com>；
2. 左侧进入 **Workers & Pages**（计算 / Workers 和 Pages），点击你的 Worker（默认叫 `subflare`）；
3. 进入 **Settings**（设置）→ **Domains & Routes**（域和路由）→ **Add**（添加）→ **Custom domain**（自定义域）；
4. 输入一个子域名，例如 `sub.example.com`，点击 **Add domain**；
5. 等待几分钟，证书签发完成后即可通过 `https://sub.example.com` 访问。

绑定后，在 SubFlare 中复制的订阅链接会自动使用你当前访问的域名。**已经导入客户端的旧链接（`workers.dev` 开头的）需要用新域名重新复制导入一次。**

---

## 常见问题

**Q：登录时提示 “SUBFLARE_TOKEN 未配置”**
A：没有设置令牌，或刚设置还没生效。网页部署用户在 Cloudflare 后台 Worker → **Settings → Variables and Secrets** 中检查是否有 `SUBFLARE_TOKEN`；命令行部署用户重新运行 `npm run setup`。设置后等半分钟再试。

**Q：忘记登录令牌了**
A：令牌无法找回，但可以重新设置：命令行部署在 `.env.deploy` 中填写新的 `SUBFLARE_TOKEN=` 后运行 `npm run setup`；网页部署在 Worker → **Settings → Variables and Secrets** 中编辑 `SUBFLARE_TOKEN`。已生成的订阅链接不受影响。

**Q：剩余流量 / 到期时间显示 “—”**
A：只有 **云端快照** 模式能获取（来自机场返回的 `subscription-userinfo` 信息）；客户端拉取模式下由客户端自己显示。如果机场返回的总流量为 0，会显示为“不限量”。

**Q：云端快照模式提示更新失败 / 没有解析到节点**
A：部分机场会屏蔽 Cloudflare 的服务器 IP。改用 **客户端拉取** 模式即可。

**Q：免费套餐够用吗？**
A：个人使用完全够用。SubFlare 只用到 Workers、D1、KV、Cron 的免费额度。

**Q：数据存在哪里？安全吗？**
A：所有数据都在你自己 Cloudflare 账号下的 D1 数据库里，不会发送给任何第三方。
