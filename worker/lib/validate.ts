import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (result.success) return;
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : "Invalid request";
    return c.json({ error: message, code: "VALIDATION_ERROR" as const }, 400);
  });
