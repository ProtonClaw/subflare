import { toast } from "sonner";

export async function copyText(text: string, label = "已复制到剪贴板") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("复制失败，请手动复制");
  }
}
