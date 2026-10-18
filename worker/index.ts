import { app } from "./app";
import { createD1SubscriptionRepository, statsDay } from "./db/repo";
import { refreshDueSubscriptions } from "./lib/auto-refresh";
import { PULL_LOG_RETENTION_DAYS } from "./lib/pull-log";
import { pruneAuthFailures } from "./lib/rate-limit";

const PULL_STATS_RETENTION_DAYS = 30;

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      refreshDueSubscriptions(env).then((summary) =>
        console.log(`[cron] ${controller.cron}`, JSON.stringify(summary))
      )
    );
    const repo = createD1SubscriptionRepository(env.DB);
    ctx.waitUntil(repo.prunePullStats(statsDay(Date.now() - PULL_STATS_RETENTION_DAYS * 86_400_000)));
    ctx.waitUntil(repo.prunePullLogs(Date.now() - PULL_LOG_RETENTION_DAYS * 86_400_000));
    ctx.waitUntil(pruneAuthFailures(env.DB));
  },
} satisfies ExportedHandler<Env>;
