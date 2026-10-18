import { Checkbox } from "@/components/ui/checkbox";
import { useModuleCategories } from "@/hooks/use-module-categories";
import type { Meta } from "@/lib/api";

export function GroupPicker({
  meta,
  value,
  onChange,
}: {
  meta: Meta;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const categories = useModuleCategories(meta);
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((g) => g !== id));

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2.5 text-xs font-medium text-muted-foreground">{cat.name}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {cat.modules.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm" title={m.description}>
                <Checkbox checked={value.includes(m.id)} onCheckedChange={(v) => toggle(m.id, v === true)} />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
