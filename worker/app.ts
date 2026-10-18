import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { publicRoutes } from "./routes/public";
import { subscriptionRoutes } from "./routes/subscriptions";
import { templateRoutes } from "./routes/templates";

const api = new Hono<{ Bindings: Env }>()
  .use(csrf())
  .route("/", healthRoutes)
  .route("/", authRoutes)
  .route("/", subscriptionRoutes)
  .route("/", templateRoutes)
  .notFound((c) => c.json({ error: "Not Found" }, 404));

export const app = new Hono<{ Bindings: Env }>().route("/api", api).route("/", publicRoutes);

export type AppType = typeof api;
