import { hc } from "hono/client";
import type { AppType } from "../../worker/app";

export const api = hc<AppType>("/").api;
