/** Heading IDs and navigation are derived from the stored Markdown, never separate seed text. */
export function slugifyHeading(text: string, index: number) {
  return `h-${index}-${text
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export function tableOfContents(body: string): TocEntry[] {
  let fence: string | null = null;
  const headings: TocEntry[] = [];
  for (const line of body.split("\n")) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker[0] ?? null;
      else if (marker[0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const match = /^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    const raw = match?.[2];
    if (!raw) continue;
    const text = raw.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
    headings.push({
      id: slugifyHeading(text, headings.length),
      text,
      level: match?.[1]?.length === 3 ? 3 : 2,
    });
  }
  return headings;
}
