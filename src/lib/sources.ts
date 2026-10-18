import type { SubscriptionInput } from "@/lib/api";

export type Source = SubscriptionInput["config"]["sources"][number];

const URL_LINE = /^https?:\/\/\S+$/i;

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Splits pasted text into sources: every line that is a bare http(s) URL becomes
 * its own URL source; everything else is kept together as one inline-nodes source.
 * Existing ids are reused for unchanged content so provider names stay stable.
 */
export function textToSources(text: string, previous: Source[] = []): Source[] {
  const urls: string[] = [];
  const rest: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (URL_LINE.test(trimmed)) {
      if (!urls.includes(trimmed)) urls.push(trimmed);
    } else {
      rest.push(line);
    }
  }

  const sources: Source[] = urls.map((content) => ({
    id: previous.find((s) => s.type === "url" && s.content === content)?.id ?? shortId(),
    type: "url",
    content,
  }));

  const nodes = rest.join("\n").trim();
  if (nodes) {
    sources.push({ id: previous.find((s) => s.type === "nodes")?.id ?? shortId(), type: "nodes", content: nodes });
  }
  return sources;
}

export function sourcesToText(sources: Source[]): string {
  const urls = sources.filter((s) => s.type === "url").map((s) => s.content);
  const nodes = sources.filter((s) => s.type === "nodes").map((s) => s.content);
  return [...urls, ...nodes].join("\n");
}

export function sourceLabel(source: Pick<Source, "type" | "content">): string {
  if (source.type === "nodes") return "手动粘贴的节点";
  try {
    return new URL(source.content).host;
  } catch {
    return source.content.slice(0, 40);
  }
}
