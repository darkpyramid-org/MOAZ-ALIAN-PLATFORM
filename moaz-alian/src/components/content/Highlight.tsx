import { Fragment } from "react";

import { normalizeArabic } from "@/lib/content";

/**
 * Marks query tokens inside display text. Matching runs on a per-character
 * normalized copy so diacritics/alef variants still match while the original
 * glyphs are what the reader sees.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = normalizeArabic(query).split(" ").filter((t) => t.length > 1);
  if (!tokens.length) return <>{text}</>;

  // Build a normalized string with a map back to original indices.
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalizeArabic(text[i]!);
    for (const ch of n) {
      norm += ch;
      map.push(i);
    }
  }
  const marks = new Array<boolean>(text.length).fill(false);
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(t, from);
      if (at < 0) break;
      for (let k = at; k < at + t.length; k++) marks[map[k]!] = true;
      from = at + t.length;
    }
  }

  const out: { s: string; m: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    // Keep diacritics attached to their marked letter.
    const m = marks[i] || (!!last?.m && normalizeArabic(text[i]!) === "");
    if (last && last.m === m) last.s += text[i];
    else out.push({ s: text[i]!, m });
  }
  return (
    <>
      {out.map((p, i) =>
        p.m ? (
          <mark key={i} className="rounded-sm bg-primary/25 px-0.5 text-foreground">
            {p.s}
          </mark>
        ) : (
          <Fragment key={i}>{p.s}</Fragment>
        ),
      )}
    </>
  );
}
