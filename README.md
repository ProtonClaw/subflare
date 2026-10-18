# SubFlare

Self-hosted Clash / Mihomo subscription converter and manager that runs entirely on Cloudflare Workers (free plan friendly).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ProtonClaw/subflare)

> 第一次部署？请看 **[部署指南（中文）](./docs/deploy.md)**：网页一键部署、命令行一键部署、绑定自定义域名、第一次使用和常见问题。

> Status: early development. Mihomo output works end to end; PostgreSQL / local Node runtime and more client formats are planned.

## Features

- Merge airport subscription URLs and raw nodes (ss / vmess / vless / trojan / hysteria2 / tuic / …, Base64, Clash YAML) into one Mihomo config
- Rule templates (minimal / standard / full) with per-group customization
- Two node modes:
  - **Client fetch** (default): emits `proxy-providers`, so the client downloads nodes from the airport directly — works even when airports block Cloudflare egress
  - **Cloud snapshot**: the Worker fetches and parses nodes, shows traffic / expiry, and refreshes on a Cron schedule
- One link per subscription, QR code, one-click import into Clash / Stash, link rotation
- Overview: traffic / expiry summary, 7-day pull trend by client, and alerts for failed refreshes, expiring plans or unused links
- Single-admin token login (HttpOnly session cookie or `Authorization: Bearer`)

## Stack

- Cloudflare Workers + Static Assets, built with the Cloudflare Vite plugin
- API: Hono (typed RPC client for the frontend), Zod validation
- Frontend: React, Tailwind CSS, shadcn/ui, TanStack Query
- Database: Drizzle ORM — Cloudflare D1 / SQLite, PostgreSQL planned
- Cache: Workers KV; scheduled refresh via Cron Triggers

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # set SUBFLARE_TOKEN
npm run db:migrate:local
npm run dev
```

## Deploy

Click the button above, or follow the step-by-step guide: [docs/deploy.md](./docs/deploy.md) (Chinese).

One command, non-interactive (also used for updates):

```bash
echo "CLOUDFLARE_API_TOKEN=<token>" > .env.deploy   # optional: SUBFLARE_TOKEN, CLOUDFLARE_ACCOUNT_ID
npm run setup   # install, build, deploy (auto-provisions D1 and KV), migrate, set login token (generated if missing)
```

Or step by step:

```bash
npx wrangler login
npm run deploy                         # build, deploy (auto-provisions D1 and KV), apply D1 migrations
npx wrangler secret put SUBFLARE_TOKEN # login token, at least 8 characters
```

`*.workers.dev` is not reachable from mainland China; bind a custom domain in the Cloudflare dashboard if needed.

## License

[AGPL-3.0-only](./LICENSE). Parts of this project are derived from [SubBoost](https://github.com/SubBoost/subboost) (AGPL-3.0-only).
