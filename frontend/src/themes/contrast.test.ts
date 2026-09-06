import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG contrast gate for every palette (refactor doc 04 §6, after IGAB's contrast.test.ts).
 * Body text must reach AA (4.5:1); UI/large text and subtle text 3:1. Only hex tokens are
 * checked (rgba/color-mix values are derived from checked colours). Dark blocks inherit the
 * light block's tokens, as they do in the cascade.
 */

const THEMES_DIR = join(__dirname);

interface Block {
  selector: string;
  tokens: Record<string, string>;
}

function parseBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!selector.includes("data-theme") && !selector.includes(":root")) continue;
    const tokens: Record<string, string> = {};
    for (const line of m[2].split(";")) {
      const t = line.match(/\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*$/);
      if (t) tokens[t[1]] = t[2];
    }
    blocks.push({ selector, tokens });
  }
  return blocks;
}

function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** [foreground token, background token, minimum ratio, what it is] */
const PAIRS: [string, string, number, string][] = [
  ["--color-text", "--color-bg", 4.5, "body text on page"],
  ["--color-text", "--color-surface", 4.5, "body text on cards"],
  ["--color-text-muted", "--color-bg", 4.5, "muted text on page"],
  ["--color-text-muted", "--color-surface", 4.5, "muted text on cards"],
  ["--color-text-subtle", "--color-bg", 3, "subtle text on page"],
  ["--color-section-title", "--color-bg", 4.5, "section titles"],
  ["--color-accent-fg", "--color-accent", 4.5, "text on accent buttons"],
  ["--color-ai-fg", "--color-ai", 4.5, "text on AI buttons"],
  ["--color-nlp-fg", "--color-nlp", 3, "text on NLP badges"],
];

const files = readdirSync(THEMES_DIR).filter((f) => f.endsWith(".css") && f !== "base.css");

describe("theme contrast (WCAG)", () => {
  for (const file of files) {
    const css = readFileSync(join(THEMES_DIR, file), "utf8");
    const blocks = parseBlocks(css);
    const light = blocks.find((b) => !b.selector.includes(".dark"));
    it(`${file} defines a palette`, () => {
      expect(light, "light block").toBeDefined();
      expect(Object.keys(light!.tokens).length).toBeGreaterThan(10);
    });
    for (const block of blocks) {
      const tokens = block.selector.includes(".dark") ? { ...light!.tokens, ...block.tokens } : block.tokens;
      it(`${file} ${block.selector.includes(".dark") ? "dark" : "light"} meets the minimum ratios`, () => {
        const failures: string[] = [];
        for (const [fg, bg, min, what] of PAIRS) {
          const a = tokens[fg];
          const b = tokens[bg];
          if (!a || !b) continue; // derived value (rgba/color-mix) or not defined
          const ratio = contrast(a, b);
          if (ratio < min)
            failures.push(`${what}: ${fg} ${a} on ${bg} ${b} = ${ratio.toFixed(2)} (< ${min})`);
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
