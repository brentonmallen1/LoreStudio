import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An icon is not a name (doc 17). jsx-a11y cannot see inside `<X />`, so this finds every
 * `<button>` whose only child is one component (an icon, or `{cond && <Icon />}`) and asks
 * for an aria-label. A title alone is a mouse-only tooltip; give both.
 */

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") && !name.includes(".test.")) out.push(path);
  }
  return out;
}

/** Index of the `>` closing an opening tag that starts at `from`, skipping `{…}` and strings. */
function tagEnd(s: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let j = from; j < s.length; j++) {
    const c = s[j];
    if (quote) {
      if (c === quote && s[j - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || (c === "`" && depth > 0)) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return j;
  }
  return -1;
}

const ICON_ONLY = /^\s*(?:\{[^{}]*&&\s*)?<([A-Z]\w*)\b[^<>]*?\/>\s*\}?\s*$/s;

export function unnamedIconButtons(source: string): number[] {
  const lines: number[] = [];
  for (const m of source.matchAll(/<button\b/g)) {
    const end = tagEnd(source, m.index! + 7);
    if (end < 0 || source[end - 1] === "/") continue;
    const close = source.indexOf("</button>", end);
    if (close < 0) continue;
    const inner = source.slice(end + 1, close);
    if (inner.includes("<button") || !ICON_ONLY.test(inner)) continue;
    if (/aria-label(?:ledby)?\s*=/.test(source.slice(m.index!, end))) continue;
    lines.push(source.slice(0, m.index).split("\n").length);
  }
  return lines;
}

describe("icon-only buttons", () => {
  it("finds an unnamed one and accepts a named one", () => {
    expect(unnamedIconButtons(`<button onClick={() => go()}>\n  <X size={12} />\n</button>`)).toEqual([1]);
    expect(unnamedIconButtons(`<button aria-label="Close" onClick={close}><X /></button>`)).toEqual([]);
    expect(unnamedIconButtons(`<button onClick={a}><X /> Close</button>`)).toEqual([]);
  });

  it("every one in the app has an aria-label", () => {
    const offenders = walk(SRC).flatMap((f) =>
      unnamedIconButtons(readFileSync(f, "utf8")).map((line) => `${relative(SRC, f)}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});
