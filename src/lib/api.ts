import { hc, type InferRequestType, type InferResponseType } from "hono/client";
import type { AppType } from "../../worker/app";

export const api = hc<AppType>("/api");

export type SubscriptionSummary = InferResponseType<typeof api.subscriptions.$get, 200>["items"][number];
export type SubscriptionDetail = InferResponseType<(typeof api.subscriptions)[":id"]["$get"], 200>;
export type SubscriptionInput = InferRequestType<typeof api.subscriptions.$post>["json"];
export type PreviewResult = InferResponseType<typeof api.preview.$post, 200>;
export type Meta = InferResponseType<typeof api.meta.$get, 200>;
export type PullStats = InferResponseType<typeof api.stats.pulls.$get, 200>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };

export async function unwrap<T>(promise: Promise<JsonResponse>): Promise<T> {
  const res = await promise;
  const body = (await res.json().catch(() => ({}))) as { error?: unknown; code?: string };
  if (!res.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : body.error && typeof body.error === "object" && "message" in body.error
          ? String((body.error as { message: unknown }).message)
          : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body.code);
  }
  return body as T;
}

export function subscriptionUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
