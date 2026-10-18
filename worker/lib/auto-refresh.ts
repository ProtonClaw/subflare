import { createD1SubscriptionRepository } from "../db/repo";
import { invalidateYaml } from "./render";
import { buildSnapshot } from "./snapshot";

// Free-plan invocations allow 50 external subrequests; each subscription may fetch several sources.
const MAX_PER_RUN = 5;

export async function refreshDueSubscriptions(env: Env) {
  const repo = createD1SubscriptionRepository(env.DB);
  const due = await repo.listDueForRefresh(Date.now(), MAX_PER_RUN);
  const summary = { due: due.length, refreshed: 0, failed: 0 };

  for (const sub of due) {
    try {
      const snapshot = await buildSnapshot(sub, sub);
      await repo.saveRefresh(sub.id, snapshot);
      await invalidateYaml(env.KV, sub.token);
      if (snapshot.lastError) summary.failed++;
      else summary.refreshed++;
    } catch (error) {
      summary.failed++;
      console.error(`[cron] refresh ${sub.id} failed`, error);
    }
  }
  return summary;
}
