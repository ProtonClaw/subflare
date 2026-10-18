import { app } from "./app";
import { createD1SubscriptionRepository, statsDay } from "./db/repo";
import { refreshDueSubscriptions } from "./lib/auto-refresh";

const PULL_STATS_RETENTION_DAYS = 30;

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      refreshDueSubscriptions(env).then((summary) =>
        console.log(`[cron] ${controller.cron}`, JSON.stringify(summary))
      )
    );
    ctx.waitUntil(
      createD1SubscriptionRepository(env.DB).prunePullStats(
        statsDay(Date.now() - PULL_STATS_RETENTION_DAYS * 86_400_000)
      )
    );
  },
} satisfies ExportedHandler<Env>;
