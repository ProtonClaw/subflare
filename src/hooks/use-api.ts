import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  unwrap,
  type Meta,
  type NodeEdits,
  type NodeState,
  type PullLogFilters,
  type PullLogPage,
  type PullStats,
  type TemplateDetail,
  type TemplateInput,
  type TemplateSummary,
  type PreviewResult,
  type SubscriptionDetail,
  type SubscriptionInput,
  type SubscriptionSummary,
} from "@/lib/api";
import { TEMPLATE_LABEL } from "@/lib/modes";

type Me = { configured: boolean; authenticated: boolean };

export const keys = {
  me: ["me"] as const,
  meta: ["meta"] as const,
  list: ["subscriptions"] as const,
  pulls: ["stats", "pulls"] as const,
  pullLogs: ["stats", "pull-logs"] as const,
  templates: ["templates"] as const,
  detail: (id: string) => ["subscriptions", id] as const,
  nodes: (id: string) => ["subscriptions", id, "nodes"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => unwrap<Me>(api.auth.me.$get()) });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => unwrap<{ ok: true }>(api.auth.login.$post({ json: { token } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap<{ ok: true }>(api.auth.logout.$post()),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData<Me>(keys.me, { configured: true, authenticated: false });
    },
  });
}

export function useMeta() {
  return useQuery({ queryKey: keys.meta, queryFn: () => unwrap<Meta>(api.meta.$get()), staleTime: Infinity });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: keys.list,
    queryFn: async () => (await unwrap<{ items: SubscriptionSummary[] }>(api.subscriptions.$get())).items,
  });
}

export function usePullLogs(filters: PullLogFilters) {
  return useInfiniteQuery({
    queryKey: [...keys.pullLogs, filters],
    queryFn: ({ pageParam }) =>
      unwrap<PullLogPage>(
        api.stats["pull-logs"].$get({ query: { ...filters, ...(pageParam ? { before: String(pageParam) } : {}) } })
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: 60_000,
  });
}

export function usePullStats({ days, subscriptionId }: { days: number; subscriptionId?: string }) {
  return useQuery({
    queryKey: [...keys.pulls, days, subscriptionId ?? "all"],
    queryFn: () =>
      unwrap<PullStats>(
        api.stats.pulls.$get({ query: { days: String(days), ...(subscriptionId ? { subscriptionId } : {}) } })
      ),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === (subscriptionId ?? "all") ? prev : undefined),
    refetchInterval: 60_000,
  });
}

export function useSubscription(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    queryFn: () => unwrap<SubscriptionDetail>(api.subscriptions[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}

export function usePreview() {
  return useMutation({
    mutationFn: (json: Pick<SubscriptionInput, "mode"> & { sources: SubscriptionInput["config"]["sources"] }) =>
      unwrap<PreviewResult>(api.preview.$post({ json })),
  });
}

function useInvalidateList() {
  const qc = useQueryClient();
  return (detail?: SubscriptionDetail) => {
    if (detail) {
      qc.setQueryData(keys.detail(detail.id), detail);
      void qc.invalidateQueries({ queryKey: keys.nodes(detail.id) });
    }
    return qc.invalidateQueries({ queryKey: keys.list, exact: true });
  };
}

export function useSaveSubscription() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SubscriptionInput }) =>
      unwrap<SubscriptionDetail>(
        id ? api.subscriptions[":id"].$put({ param: { id }, json: input }) : api.subscriptions.$post({ json: input })
      ),
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useRefreshSubscription() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (id: string) => unwrap<SubscriptionDetail>(api.subscriptions[":id"].refresh.$post({ param: { id } })),
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useNodeState(id: string) {
  return useQuery({
    queryKey: keys.nodes(id),
    queryFn: () => unwrap<NodeState>(api.subscriptions[":id"].nodes.$get({ param: { id } })),
  });
}

export function useEditNodes(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (edits: NodeEdits) =>
      unwrap<NodeState>(api.subscriptions[":id"].nodes.$patch({ param: { id }, json: edits })),
    onSuccess: (state) => {
      qc.setQueryData(keys.nodes(id), state);
      void qc.invalidateQueries({ queryKey: keys.detail(id), exact: true });
      void qc.invalidateQueries({ queryKey: keys.list, exact: true });
    },
  });
}

export function useRotateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ token: string }>(api.subscriptions[":id"]["rotate-token"].$post({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ ok: true }>(api.subscriptions[":id"].$delete({ param: { id } })),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.detail(id) });
      void qc.invalidateQueries({ queryKey: keys.pulls });
      return qc.invalidateQueries({ queryKey: keys.list, exact: true });
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates,
    queryFn: async () => (await unwrap<{ items: TemplateSummary[] }>(api.templates.$get())).items,
  });
}

/** Display name for a subscription's template, preferring the custom template name. */
export function useTemplateName() {
  const templates = useTemplates();
  return (base: TemplateSummary["base"], templateId: string | null | undefined) => {
    const custom = templateId ? templates.data?.find((t) => t.id === templateId) : undefined;
    return custom ? custom.name : `${TEMPLATE_LABEL[base]}模板`;
  };
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: [...keys.templates, id ?? ""],
    queryFn: () => unwrap<TemplateDetail>(api.templates[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TemplateInput }) =>
      unwrap<Omit<TemplateDetail, "usedBy">>(
        id ? api.templates[":id"].$put({ param: { id }, json: input }) : api.templates.$post({ json: input })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ ok: true }>(api.templates[":id"].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates }),
  });
}
