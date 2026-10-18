# SubFlare

Self-hosted proxy subscription converter and manager that runs entirely on Cloudflare Workers, with an optional single-process local deployment.

> Status: early development (phase 0 — platform skeleton).

## Stack

- Cloudflare Workers + Static Assets, built with the Cloudflare Vite plugin
- API: Hono (typed RPC client for the frontend)
- Frontend: React + Tailwind CSS
- Database: Drizzle ORM — Cloudflare D1 / SQLite, PostgreSQL planned
- Cache: Workers KV; scheduled refresh via Cron Triggers

## Development

```bash
npm install
npm run db:migrate:local
npm run dev
```

## Deploy

```bash
npx wrangler login
npm run deploy            # auto-provisions D1 and KV on first deploy
npm run db:migrate:remote
```

## License

[AGPL-3.0-only](./LICENSE). Parts of this project are derived from [SubBoost](https://github.com/SubBoost/subboost) (AGPL-3.0-only).
