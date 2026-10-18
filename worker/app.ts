import { Hono } from "hono";
import { healthRoutes } from "./routes/health";

export const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .route("/", healthRoutes)
  .notFound((c) => c.json({ error: "Not Found" }, 404));

export type AppType = typeof app;
