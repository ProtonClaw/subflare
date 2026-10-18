export type RenameRule = {
  include: string;
  exclude: string;
  find: string;
  replace: string;
  trim: boolean;
};

export type RenameChange = { from: string; to: string; problem?: "empty" | "duplicate" };

export type RenamePlan = { error?: string; matched: number; changes: RenameChange[] };

function compile(pattern: string, flags: string): RegExp | null | "invalid" {
  if (!pattern.trim()) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return "invalid";
  }
}

/** `scope` limits renaming to these names; every name in `allNames` is checked for collisions. */
export function planRenames(allNames: string[], scope: string[], rule: RenameRule): RenamePlan {
  const include = compile(rule.include, "i");
  const exclude = compile(rule.exclude, "i");
  const find = compile(rule.find, "g");
  if (include === "invalid") return { error: "筛选正则无效", matched: 0, changes: [] };
  if (exclude === "invalid") return { error: "排除正则无效", matched: 0, changes: [] };
  if (find === "invalid") return { error: "查找正则无效", matched: 0, changes: [] };

  const targets = scope.filter((name) => (!include || include.test(name)) && !(exclude && exclude.test(name)));
  const proposed = new Map<string, string>();
  for (const name of targets) {
    let next = find ? name.replace(find, rule.replace) : name;
    if (rule.trim) next = next.replace(/\s+/g, " ").trim();
    if (next !== name) proposed.set(name, next);
  }

  const finalCounts = new Map<string, number>();
  for (const name of allNames) {
    const final = proposed.get(name) ?? name;
    finalCounts.set(final, (finalCounts.get(final) ?? 0) + 1);
  }

  const changes = [...proposed].map(([from, to]): RenameChange => {
    if (!to.trim()) return { from, to, problem: "empty" };
    if ((finalCounts.get(to) ?? 0) > 1) return { from, to, problem: "duplicate" };
    return { from, to };
  });
  return { matched: targets.length, changes };
}
