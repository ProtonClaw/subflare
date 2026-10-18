# SubFlare 部署指南

SubFlare 完全运行在 Cloudflare 上，**免费套餐即可使用**，不需要自己的服务器。

部署有两种方式，任选其一：

| 方式 | 适合谁 | 需要准备 |
|---|---|---|
| [方式一：一键部署](#方式一一键部署推荐) | 第一次用、不想碰命令行 | Cloudflare 账号 + GitHub 账号 |
| [方式二：手动部署](#方式二手动部署命令行) | 熟悉命令行、想自己掌控代码 | Cloudflare 账号 + 一台装了 Node.js 22+ 的电脑 |

部署完成后，请继续看 [部署后：第一次使用](#部署后第一次使用) 和 [绑定自定义域名](#绑定自定义域名国内访问必看)。

> ⚠️ **国内用户必读**：Cloudflare 默认分配的 `*.workers.dev` 域名在中国大陆通常**无法直接访问**。如果你的客户端在国内直连拉取订阅，需要[绑定自己的域名](#绑定自定义域名国内访问必看)。

---

## 准备工作

1. **Cloudflare 账号**：在 <https://dash.cloudflare.com/sign-up> 免费注册。
2. **GitHub 账号**（仅方式一需要）：在 <https://github.com/signup> 免费注册。
3. **准备一个登录令牌**：这是你登录 SubFlare 后台的唯一密码。
   - 至少 8 位，建议 32 位随机字符，**不要使用示例里的 `change-me-please`**。
   - 生成方法（任选一种）：
     - macOS / Linux 终端：`openssl rand -hex 16`
     - 或者用密码管理器生成一串随机密码
   - 请把它保存好，后面登录要用。

---

## 方式一：一键部署（推荐）

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

### 以后如何更新（一键部署用户）

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

## 方式二：手动部署（命令行）

### 第 1 步：安装 Node.js 和 Git

- **Node.js 22 或更高版本**：从 <https://nodejs.org/zh-cn> 下载 LTS 版本安装。
- **Git**：从 <https://git-scm.com/downloads> 下载安装。

安装完成后打开终端（Windows 用 PowerShell），确认版本：

```bash
node -v   # 应显示 v22.x.x 或更高
git --version
```

### 第 2 步：下载代码并安装依赖

```bash
git clone https://github.com/ProtonClaw/subflare.git
cd subflare
npm install
```

> 国内下载依赖慢，可以先执行 `npm config set registry https://registry.npmmirror.com` 切换到国内镜像。

### 第 3 步：登录 Cloudflare

```bash
npx wrangler login
```

浏览器会自动打开 Cloudflare 授权页面，点击 **Allow**（允许）。终端显示 `Successfully logged in` 即成功。

> 在没有浏览器的服务器上：改用 API Token。在 Cloudflare 后台 **My Profile → API Tokens → Create Token** 使用 **Edit Cloudflare Workers** 模板创建，并额外勾选 **D1 Edit** 权限，然后执行 `export CLOUDFLARE_API_TOKEN=<你的 token>`。

### 第 4 步：部署

```bash
npm run deploy
```

这一条命令会依次完成：

1. 构建前端和 Worker；
2. 上传 Worker，并**自动创建** D1 数据库（名为 `subflare`）和 KV 命名空间；
3. 在远程数据库上创建所需的表。

可能遇到的交互提示：

- 如果是第一次在这个 Cloudflare 账号上使用 Workers，会提示你注册一个 `workers.dev` 子域，输入一个喜欢的名字即可（比如你的用户名）。
- 如果提示 “Ok to proceed?”，输入 `y` 回车。

成功后终端会输出访问地址，形如：

```text
https://subflare.<你的子域>.workers.dev
```

### 第 5 步：设置登录令牌

```bash
npx wrangler secret put SUBFLARE_TOKEN
```

提示 `Enter a secret value:` 时，粘贴你在准备工作里生成的令牌，回车。看到 `Success! Uploaded secret SUBFLARE_TOKEN` 即成功。

> 令牌生效需要几十秒。如果马上登录提示 “SUBFLARE_TOKEN 未配置”，等半分钟刷新即可。

### 以后如何更新（手动部署用户）

```bash
cd subflare
git pull
npm install
npm run deploy
```

`npm run deploy` 每次都会自动执行新的数据库迁移，已有数据不会丢失，登录令牌也会保留。

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
A：没有设置令牌，或刚设置还没生效。一键部署用户在 Cloudflare 后台 Worker → **Settings → Variables and Secrets** 中检查是否有 `SUBFLARE_TOKEN`；手动部署用户重新执行第 5 步。设置后等半分钟再试。

**Q：忘记登录令牌了**
A：令牌无法找回，但可以重新设置：手动部署执行 `npx wrangler secret put SUBFLARE_TOKEN`；一键部署在 Worker → **Settings → Variables and Secrets** 中编辑 `SUBFLARE_TOKEN`。已生成的订阅链接不受影响。

**Q：剩余流量 / 到期时间显示 “—”**
A：只有 **云端快照** 模式能获取（来自机场返回的 `subscription-userinfo` 信息）；客户端拉取模式下由客户端自己显示。如果机场返回的总流量为 0，会显示为“不限量”。

**Q：云端快照模式提示更新失败 / 没有解析到节点**
A：部分机场会屏蔽 Cloudflare 的服务器 IP。改用 **客户端拉取** 模式即可。

**Q：免费套餐够用吗？**
A：个人使用完全够用。SubFlare 只用到 Workers、D1、KV、Cron 的免费额度。

**Q：数据存在哪里？安全吗？**
A：所有数据都在你自己 Cloudflare 账号下的 D1 数据库里，不会发送给任何第三方。
