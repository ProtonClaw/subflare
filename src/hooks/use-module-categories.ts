import { useMemo } from "react";
import type { Meta } from "@/lib/api";

export function useModuleCategories(meta: Meta) {
  return useMemo(() => {
    const byCat = new Map<string, Meta["modules"]>();
    for (const m of meta.modules) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
    return [...byCat.entries()]
      .sort(([a], [b]) => (meta.categories[a]?.order ?? 99) - (meta.categories[b]?.order ?? 99))
      .map(([id, modules]) => ({ id, name: meta.categories[id]?.name ?? id, modules }));
  }, [meta]);
}
