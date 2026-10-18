import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import { count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { subscriptions, templates } from "./schema";

export type CustomTemplate = {
  id: string;
  name: string;
  description: string;
  config: SubBoostTemplateConfig;
  createdAt: number;
  updatedAt: number;
};

export type CustomTemplateSummary = Omit<CustomTemplate, "config"> & {
  base: SubBoostTemplateConfig["template"];
  groupCount: number;
  customRuleCount: number;
  usedBy: number;
};

export type TemplateInput = Pick<CustomTemplate, "name" | "description" | "config">;

export interface TemplateRepository {
  list(): Promise<CustomTemplateSummary[]>;
  get(id: string): Promise<CustomTemplate | null>;
  create(input: TemplateInput & { id: string }): Promise<CustomTemplate>;
  update(id: string, input: TemplateInput): Promise<CustomTemplate | null>;
  delete(id: string): Promise<boolean>;
}

type Row = typeof templates.$inferSelect;

function toTemplate(row: Row): CustomTemplate {
  return { ...row, config: JSON.parse(row.config) as SubBoostTemplateConfig };
}

export function createD1TemplateRepository(d1: D1Database): TemplateRepository {
  const db = drizzle(d1);

  return {
    async list() {
      const rows = await db
        .select({ template: templates, usedBy: count(subscriptions.id) })
        .from(templates)
        .leftJoin(subscriptions, eq(subscriptions.templateId, templates.id))
        .groupBy(templates.id)
        .orderBy(desc(templates.updatedAt))
        .all();
      return rows.map(({ template, usedBy }) => {
        const { config, ...rest } = toTemplate(template);
        return {
          ...rest,
          base: config.template,
          groupCount: config.enabledProxyGroups.length,
          customRuleCount: config.customRules.length,
          usedBy,
        };
      });
    },
    async get(id) {
      const row = await db.select().from(templates).where(eq(templates.id, id)).get();
      return row ? toTemplate(row) : null;
    },
    async create(input) {
      const now = Date.now();
      const row = await db
        .insert(templates)
        .values({ ...input, config: JSON.stringify(input.config), createdAt: now, updatedAt: now })
        .returning()
        .get();
      return toTemplate(row);
    },
    async update(id, input) {
      const row = await db
        .update(templates)
        .set({ ...input, config: JSON.stringify(input.config), updatedAt: Date.now() })
        .where(eq(templates.id, id))
        .returning()
        .get();
      return row ? toTemplate(row) : null;
    },
    async delete(id) {
      const row = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id }).get();
      return !!row;
    },
  };
}
