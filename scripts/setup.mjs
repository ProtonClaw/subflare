#!/usr/bin/env node
// One-shot, non-interactive deploy: npm run setup
// Reads CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID, SUBFLARE_TOKEN) from env or ./.env.deploy.
// Not ./.env: the Cloudflare Vite plugin copies .env into the build output and the local dev Worker env.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

const ENV_FILE = ".env.deploy";
const MIN_NODE_MAJOR = 22;
const MIN_TOKEN_LENGTH = 8;

function fail(lines) {
  console.error(`\n❌ ${lines.join("\n   ")}\n`);
  process.exit(1);
}

function run(cmd, args, { input, capture = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: process.platform === "win32",
      stdio: [input === undefined ? "ignore" : "pipe", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
    });
    let output = "";
    if (capture) {
      child.stdout.on("data", (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
        process.stderr.write(chunk);
      });
    }
    if (input !== undefined) child.stdin.end(input);
    child.on("close", (code) => resolve({ code, output }));
  });
}

function runQuiet(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: process.platform === "win32", stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < MIN_NODE_MAJOR) {
  fail([`需要 Node.js ${MIN_NODE_MAJOR} 或更高版本，当前是 ${process.version}。`, "请从 https://nodejs.org/zh-cn 安装 LTS 版本。"]);
}

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
  console.log(`已读取 ${ENV_FILE}`);
}

if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_API_KEY) {
  fail([
    "缺少 CLOUDFLARE_API_TOKEN。",
    "创建方法见 docs/deploy.md 的「创建 Cloudflare API Token」一节，然后：",
    "  CLOUDFLARE_API_TOKEN=<你的 token> npm run setup",
    `或者把它写进项目根目录的 ${ENV_FILE} 文件。`,
  ]);
}

const siteToken = process.env.SUBFLARE_TOKEN?.trim();
if (siteToken !== undefined && siteToken.length < MIN_TOKEN_LENGTH) {
  fail([`SUBFLARE_TOKEN 至少 ${MIN_TOKEN_LENGTH} 位。`]);
}
// The child processes must not see SUBFLARE_TOKEN; it is only passed via stdin to `wrangler secret put`.
delete process.env.SUBFLARE_TOKEN;

console.log("\n[1/3] 安装依赖…");
if ((await run("npm", ["install", "--no-audit", "--no-fund"])).code !== 0) fail(["npm install 失败，请检查网络（国内可先执行 npm config set registry https://registry.npmmirror.com）。"]);

console.log("\n[2/3] 构建并部署（首次会自动创建 D1 数据库和 KV）…");
const deploy = await run("npm", ["run", "deploy"], { capture: true });
if (deploy.code !== 0) {
  fail([
    "部署失败，请根据上面的报错检查：",
    "1. API Token 权限是否齐全（Workers Scripts / D1 / Workers KV Storage 编辑，Account Settings 读取）；",
    "2. 账号下有多个 Cloudflare 账户时，需要设置 CLOUDFLARE_ACCOUNT_ID；",
    "3. 全新账号需先在网页后台打开一次 Workers & Pages，开通 workers.dev 子域：https://dash.cloudflare.com/?to=/:account/workers-and-pages",
  ]);
}
const url = deploy.output.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];

console.log("\n[3/3] 设置登录令牌…");
let printedToken = null;
if (siteToken) {
  if ((await run("npx", ["wrangler", "secret", "put", "SUBFLARE_TOKEN"], { input: siteToken })).code !== 0) fail(["设置登录令牌失败。"]);
  console.log("已使用你提供的 SUBFLARE_TOKEN。");
} else {
  const list = await runQuiet("npx", ["wrangler", "secret", "list", "--format", "json"]);
  let existing = false;
  try {
    existing = JSON.parse(list.output).some((s) => s.name === "SUBFLARE_TOKEN");
  } catch {
    fail(["无法读取线上已有的 secret 列表。"]);
  }
  if (existing) {
    console.log("线上已有登录令牌，保持不变。");
  } else {
    printedToken = randomBytes(16).toString("hex");
    if ((await run("npx", ["wrangler", "secret", "put", "SUBFLARE_TOKEN"], { input: printedToken })).code !== 0) fail(["设置登录令牌失败。"]);
  }
}

console.log("\n✅ 部署完成");
console.log(`   访问地址：${url ?? "见上方部署输出中的 workers.dev 地址"}`);
if (printedToken) {
  console.log(`   登录令牌：${printedToken}`);
  console.log("   ⚠️ 令牌只显示这一次，请立即保存。忘记后可用 SUBFLARE_TOKEN=<新令牌> npm run setup 重新设置。");
}
console.log("   令牌生效需要几十秒；*.workers.dev 在国内通常无法访问，建议绑定自定义域名（见 docs/deploy.md）。\n");
