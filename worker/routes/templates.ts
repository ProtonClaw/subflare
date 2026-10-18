import { validateSubBoostTemplateConfig } from "@subboost/core/templates/config-template";
import { Hono } from "hono";
import { z } from "zod";
import { createD1SubscriptionRepository } from "../db/repo";
import { createD1TemplateRepository } from "../db/templates-repo";
import { requireAuth, type AuthEnv } from "../lib/auth";
import { invalidateYaml } from "../lib/render";
import { validate } from "../lib/validate";

const TemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  config: z.unknown(),
});

function parseBody(body: z.infer<typeof TemplateBodySchema>) {
  const result = validateSubBoostTemplateConfig(body.config);
  return result.ok
    ? ({ ok: true, input: { name: body.name, description: body.description, config: result.config } } as const)
    : ({ ok: false, error: result.error } as const);
}

const base = new Hono<AuthEnv>();
base.use("/templates", requireAuth);
base.use("/templates/*", requireAuth);

export const templateRoutes = base
  .get("/templates", async (c) => c.json({ items: await createD1TemplateRepository(c.env.DB).list() }))
  .post("/templates", validate("json", TemplateBodySchema), async (c) => {
    const parsed = parseBody(c.req.valid("json"));
    if (!parsed.ok) return c.json({ error: parsed.error, code: "VALIDATION_ERROR" as const }, 400);
    const template = await createD1TemplateRepository(c.env.DB).create({ ...parsed.input, id: crypto.randomUUID() });
    return c.json(template, 201);
  })
  .get("/templates/:id", async (c) => {
    const id = c.req.param("id");
    const template = await createD1TemplateRepository(c.env.DB).get(id);
    if (!template) return c.json({ error: "Not Found" }, 404);
    const usedBy = await createD1SubscriptionRepository(c.env.DB).listByTemplate(id);
    return c.json({ ...template, usedBy: usedBy.map(({ id, name }) => ({ id, name })) }, 200);
  })
  .put("/templates/:id", validate("json", TemplateBodySchema), async (c) => {
    const parsed = parseBody(c.req.valid("json"));
    if (!parsed.ok) return c.json({ error: parsed.error, code: "VALIDATION_ERROR" as const }, 400);
    const id = c.req.param("id");
    const template = await createD1TemplateRepository(c.env.DB).update(id, parsed.input);
    if (!template) return c.json({ error: "Not Found" }, 404);
    const usedBy = await createD1SubscriptionRepository(c.env.DB).listByTemplate(id);
    await Promise.all(usedBy.map((s) => invalidateYaml(c.env.KV, s.token)));
    return c.json(template, 200);
  })
  .delete("/templates/:id", async (c) => {
    const id = c.req.param("id");
    const usedBy = await createD1SubscriptionRepository(c.env.DB).listByTemplate(id);
    if (usedBy.length > 0) {
      return c.json(
        {
          error: `仍有 ${usedBy.length} 个订阅在使用此模板`,
          code: "TEMPLATE_IN_USE" as const,
          usedBy: usedBy.map(({ id, name }) => ({ id, name })),
        },
        409
      );
    }
    const deleted = await createD1TemplateRepository(c.env.DB).delete(id);
    return deleted ? c.json({ ok: true }, 200) : c.json({ error: "Not Found" }, 404);
  });
