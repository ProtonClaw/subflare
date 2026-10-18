import { app } from "./app";
import { refreshDueSubscriptions } from "./lib/auto-refresh";

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      refreshDueSubscriptions(env).then((summary) =>
        console.log(`[cron] ${controller.cron}`, JSON.stringify(summary))
      )
    );
  },
} satisfies ExportedHandler<Env>;
