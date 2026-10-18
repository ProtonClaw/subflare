import { app } from "./app";

export default {
  fetch: app.fetch,
  async scheduled(controller) {
    console.log(`[cron] ${controller.cron} fired at ${new Date(controller.scheduledTime).toISOString()}`);
  },
} satisfies ExportedHandler<Env>;
