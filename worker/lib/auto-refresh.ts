import { createD1SubscriptionRepository } from "../db/repo";
import { invalidateYaml } from "./render";
import { collectNodes, summarizeErrors } from "./sources";

// Free-plan invocations allow 50 external subrequests; each subscription may fetch several sources.
const MAX_PER_RUN = 5;

export async function refreshDueSubscriptions(env: Env) {
  const repo = createD1SubscriptionRepository(env.DB);
  const due = await repo.listDueForRefresh(Date.now(), MAX_PER_RUN);
  const summary = { due: due.length, refreshed: 0, failed: 0 };

  for (const sub of due) {
    try {
      const collected = await collectNodes(sub.config.sources, { mode: sub.mode, fetchRemote: true });
      const lastError = summarizeErrors(collected.sources);
      // Keep the previous snapshot when every remote source failed, so a transient outage doesn't empty the config.
      const nodes = collected.nodes.length === 0 && lastError ? sub.nodes : collected.nodes;
      await repo.saveRefresh(sub.id, { nodes, userinfo: collected.userinfo ?? sub.userinfo, lastError });
      await invalidateYaml(env.KV, sub.token);
      if (lastError) summary.failed++;
      else summary.refreshed++;
    } catch (error) {
      summary.failed++;
      console.error(`[cron] refresh ${sub.id} failed`, error);
    }
  }
  return summary;
}
