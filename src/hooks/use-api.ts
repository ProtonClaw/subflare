import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  unwrap,
  type Meta,
  type PreviewResult,
  type SubscriptionDetail,
  type SubscriptionInput,
  type SubscriptionSummary,
} from "@/lib/api";

type Me = { configured: boolean; authenticated: boolean };

export const keys = {
  me: ["me"] as const,
  meta: ["meta"] as const,
  list: ["subscriptions"] as const,
  detail: (id: string) => ["subscriptions", id] as const,
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
    if (detail) qc.setQueryData(keys.detail(detail.id), detail);
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
      return qc.invalidateQueries({ queryKey: keys.list, exact: true });
    },
  });
}
