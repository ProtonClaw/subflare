import { stripImportedNodeControlFields } from "@subboost/core/subscription/imported-node-controls";
import {
  getNodeOriginName,
  getNodeSourceIds,
  keepOnlyValidNodeSourceIds,
  makeUniqueName,
  normalizeNodeOriginName,
} from "@subboost/core/subscription/node-source-state";
import {
  detachSourceNodesFromState,
  mergeParsedSourceNodes,
  prepareSourceParsedNodes,
} from "@subboost/core/subscription/source-node-refresh";
import type { ParsedNode } from "@subboost/core/types/node";
import type { DeletedNode, NewSubscription, Subscription } from "../db/repo";
import { collectNodes, summarizeErrors } from "./sources";

const MAX_DELETED_NODES = 1000;
const MAX_NODE_NAME_LENGTH = 120;

type SnapshotInput = Pick<NewSubscription, "mode" | "config">;

export type Snapshot = {
  nodes: ParsedNode[];
  userinfo: Subscription["userinfo"];
  lastError: string | null;
};

/**
 * Fetches all sources and merges them into the stored nodes source by source, so user renames and
 * deletions survive refreshes. A failed source keeps its previous nodes.
 */
export async function buildSnapshot(input: SnapshotInput, previous?: Subscription): Promise<Snapshot> {
  const collected = await collectNodes(input.config.sources, {
    mode: input.mode,
    fetchRemote: input.mode === "snapshot",
  });
  const lastError = summarizeErrors(collected.sources);

  const stored = previous?.nodes ?? [];
  // Snapshots saved before node management carry no source ids and no edits; rebuild them from scratch.
  const tracked = stored.some((node) => getNodeSourceIds(node).length > 0);
  const previousContent = new Map(previous?.config.sources.map((s) => [s.id, s.content.trim()]));
  const validIds = new Set(input.config.sources.map((s) => s.id));
  const deletedNodes = input.config.deletedNodes ?? [];

  let current = (tracked ? stored : [])
    .map((node) => keepOnlyValidNodeSourceIds(normalizeNodeOriginName(stripImportedNodeControlFields(node)), validIds))
    .filter((node): node is ParsedNode => node !== null);

  for (const source of input.config.sources) {
    if (source.type === "url" && input.mode === "provider") {
      current = detachSourceNodesFromState(current, source.id).nodes;
      continue;
    }
    const parsed = collected.bySource.get(source.id);
    if (!parsed) continue;
    const before = previousContent.get(source.id);
    current = mergeParsedSourceNodes(current, prepareSourceParsedNodes(parsed, {}), [], {
      sourceId: source.id,
      // A different URL is a different provider, so earlier renames no longer apply.
      treatAsNewSource: source.type === "url" && before !== undefined && before !== source.content.trim(),
      smartNodeMatchingEnabled: true,
      deletedNodes,
    }).nodes;
  }
  // Every SubFlare node belongs to a source; anything left without one is stale.
  let nodes = current.filter((node) => getNodeSourceIds(node).length > 0);

  // Keep the previous snapshot when every source failed, so a transient outage doesn't empty the config.
  if (nodes.length === 0 && lastError && stored.length > 0) nodes = stored;

  return { nodes, userinfo: collected.userinfo ?? previous?.userinfo ?? null, lastError };
}

export type NodeEdits = {
  rename?: Array<{ from: string; to: string }>;
  delete?: string[];
  /** Indexes into the current deleted-node list. */
  restore?: number[];
};

export type NodeEditResult =
  | { ok: true; nodes: ParsedNode[]; deletedNodes: DeletedNode[] }
  | { ok: false; error: string };

export function applyNodeEdits(nodes: ParsedNode[], deletedNodes: DeletedNode[], edits: NodeEdits): NodeEditResult {
  const renames = new Map<string, string>();
  for (const { from, to } of edits.rename ?? []) {
    const name = to.trim();
    if (!name) return { ok: false, error: "节点名称不能为空" };
    if (name.length > MAX_NODE_NAME_LENGTH) return { ok: false, error: `节点名称不能超过 ${MAX_NODE_NAME_LENGTH} 个字符` };
    renames.set(from, name);
  }
  const deleting = new Set(edits.delete ?? []);

  const nextDeleted = [...deletedNodes];
  let next: ParsedNode[] = [];
  for (const node of nodes) {
    if (deleting.has(node.name)) {
      nextDeleted.push({ originName: getNodeOriginName(node), name: node.name, node });
      continue;
    }
    const to = renames.get(node.name);
    next.push(to && to !== node.name ? ({ ...node, name: to } as ParsedNode) : node);
  }

  const seen = new Set<string>();
  for (const node of next) {
    if (seen.has(node.name)) return { ok: false, error: `节点名称重复：${node.name}` };
    seen.add(node.name);
  }

  const restoring = new Set(edits.restore ?? []);
  const remainingDeleted: DeletedNode[] = [];
  nextDeleted.forEach((item, index) => {
    if (!restoring.has(index) || index >= deletedNodes.length) {
      remainingDeleted.push(item);
      return;
    }
    const name = makeUniqueName(item.name, seen);
    seen.add(name);
    next = [...next, { ...item.node, name } as ParsedNode];
  });

  return { ok: true, nodes: next, deletedNodes: remainingDeleted.slice(-MAX_DELETED_NODES) };
}

export function listNodeState(sub: Pick<Subscription, "nodes" | "config">) {
  return {
    nodes: sub.nodes.map((node) => {
      const originName = getNodeOriginName(node);
      return {
        name: node.name,
        originName,
        renamed: originName !== node.name,
        type: node.type,
        server: node.server,
        port: node.port,
        sourceId: getNodeSourceIds(node)[0] ?? null,
      };
    }),
    deleted: (sub.config.deletedNodes ?? []).map((item, index) => ({
      index,
      name: item.name,
      originName: item.originName,
      type: item.node.type,
      sourceId: getNodeSourceIds(item.node)[0] ?? null,
    })),
  };
}
