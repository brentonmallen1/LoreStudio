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

/** `color-mix(in srgb, fg w%, transparent)` laid over `ground`: what a badge's tint renders as. */
function tint(fg: string, ground: string, w = 0.12): string {
  const rgb = (h: string) => {
    let x = h.replace("#", "");
    if (x.length === 3) x = [...x].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  };
  const [a, b] = [rgb(fg), rgb(ground)];
  return (
    "#" +
    a
      .map((v, i) =>
        Math.round(w * v + (1 - w) * b[i])
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** [foreground token, background token, minimum ratio, what it is] */
// Doc 17 (D3): all text meets AA, 4.5:1, on every ground it sits on. Non-text (slot dots,
// control edges, the focus ring) meets 3:1. Doc 24 (quiet chrome): the header, strip and
// rail float on the page ground with none of their own; the page and the panel are surface
// planes; groups sit in tone boxes; anything pressable takes the hover ground under the
// pointer, which is the vellum (`--color-hover` is `--color-surface-2`, base.css).
const GROUNDS: [string, string][] = [
  ["--color-bg", "the page ground and the chrome on it"],
  ["--color-surface", "the page and panel planes, cards"],
  ["--color-surface-2", "hover grounds, chips and segmented controls"],
  ["--color-tone", "tone boxes"],
];
const TEXT: [string, string][] = [
  ["--color-text", "body text"],
  ["--color-text-muted", "muted text"],
  ["--color-text-subtle", "subtle text"],
  ["--color-section-title", "section titles"],
  ["--color-accent", "accent as text"],
  ["--color-ai", "AI as text"],
  ["--color-nlp", "analysis as text"],
  ["--color-editorial", "editorial as text"],
  ["--color-danger", "danger as text"],
  ["--color-warning", "warning as text"],
  ["--color-success", "success as text"],
  ["--color-ai-coach", "coach as text"],
  ["--color-planner", "planner as text"],
  ["--color-brainstorm", "brainstorm as text"],
  ...["act", "chapter", "scene", "section", "beat", "part", "stage"].map((s): [string, string] => [
    `--segment-${s}`,
    `${s} label`,
  ]),
  ...["planned", "draft", "revised", "final"].map((s): [string, string] => [`--status-${s}`, `${s} badge`]),
];
const FILLS = ["accent", "ai", "nlp", "editorial", "ai-coach", "planner", "brainstorm"];

const PAIRS: [string, string, number, string][] = [
  ...TEXT.flatMap(([fg, what]) =>
    GROUNDS.map(([bg, where]): [string, string, number, string] => [fg, bg, 4.5, `${what} on ${where}`]),
  ),
  // Reading text well past AA (2026-10-09: AA alone read faint): the prose and body text on the
  // page, and in the side panel's tone box. A floor for every palette, light and dark.
  ["--color-text", "--color-surface", 12, "body text on the page, for easy reading"],
  ["--color-text", "--color-tone", 11, "body text in the side panel, for easy reading"],
  // Hover grounds and raised cards carry body and muted text; subtle text appears there on hover.
  ["--color-text", "--color-surface-3", 4.5, "body text on hover"],
  ["--color-text", "--color-surface-raised", 4.5, "body text on raised cards"],
  ["--color-text-muted", "--color-surface-3", 4.5, "muted text on hover"],
  ["--color-text-muted", "--color-surface-raised", 4.5, "muted text on raised cards"],
  ["--color-text-subtle", "--color-surface-3", 3, "subtle text on hover"],
  // Text on filled buttons and badges, at rest and under the pointer.
  ...FILLS.flatMap((f): [string, string, number, string][] => [
    [`--color-${f}-fg`, `--color-${f}`, 4.5, `text on ${f} buttons`],
    [`--color-${f}-fg`, `--color-${f}-hover`, 4.5, `text on ${f} buttons under the pointer`],
  ]),
  ["--color-danger", "--color-danger-bg", 4.5, "danger text on its tint"],
  // Coloured text on a 12% tint of itself: status and type badges, role and type pills.
  ...TEXT.slice(4).flatMap(([fg, what]) =>
    GROUNDS.map(([bg, where]): [string, string, number, string] => [
      fg,
      `tint:${bg}`,
      4.5,
      `${what} on its own tint on ${where}`,
    ]),
  ),
  // Palette slots (doc 11 P2): used as ink (dots, rings, underlines, chip fills), so 3:1 on
  // every ground, and the text on a filled chip reaches 4.5.
  ...Array.from({ length: 8 }, (_, i) => i + 1).flatMap((n): [string, string, number, string][] => [
    ...GROUNDS.map(([bg, where]): [string, string, number, string] => [
      `--cat-${n}`,
      bg,
      3,
      `slot ${n} on ${where}`,
    ]),
    [`--cat-${n}-fg`, `--cat-${n}`, 4.5, `text on slot ${n}`],
  ]),
  // The edge of an input, select or toggle (WCAG 1.4.11), and the keyboard focus ring.
  ...GROUNDS.map(([bg, where]): [string, string, number, string] => [
    "--color-control-border",
    bg,
    3,
    `control edges on ${where}`,
  ]),
  ...[...GROUNDS, ["--color-surface-3", "hover"] as [string, string]].map(
    ([bg, where]): [string, string, number, string] => ["--color-focus", bg, 3, `focus ring on ${where}`],
  ),
  // Rules that remain (doc 13 P7, narrowed by doc 24): the edge of a card and the hairline
  // between rows. Not text, so not WCAG's 3:1, but under these they vanished, worst in dark
  // mode. The header, strip and panel tab bar have no rules any more: they float on the page
  // ground, and the planes beside them are told apart by tone.
  ["--color-border", "--color-surface", 1.35, "rules on cards"],
  ["--color-border", "--color-bg", 1.3, "rules on the page"],
  ["--color-border-light", "--color-surface", 1.15, "hairlines between rows on cards"],
  // A plane must read as a plane against the ground it floats on, and a tone box against the
  // plane it sits in (doc 24). Floors measured on the quietest palette, so none is lost.
  ["--color-surface", "--color-bg", 1.03, "the page plane against the ground"],
  ["--color-tone", "--color-surface", 1.03, "a tone box on a plane"],
];

/** Tokens every palette must define in hex, light and dark, or the pairs above are silently skipped. */
const REQUIRED = [
  ...Array.from({ length: 8 }, (_, i) => [`--cat-${i + 1}`, `--cat-${i + 1}-fg`]).flat(),
  "--status-planned",
  "--status-draft",
  "--status-revised",
  "--status-final",
  "--color-tone",
];

/**
 * Zen's light block is also `:root`, so any token another palette leaves out silently takes
 * Zen's light value, even in dark mode (doc 17 found the coach, planner and brainstorm
 * colours doing this). Every palette's light block declares everything Zen's does.
 */
function declared(css: string): Set<string> {
  const first = css.match(/\{([^}]*)\}/);
  return new Set([...(first?.[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

const files = readdirSync(THEMES_DIR).filter((f) => f.endsWith(".css") && f !== "base.css");

const ZEN_TOKENS = declared(readFileSync(join(THEMES_DIR, "zen.css"), "utf8"));

describe("theme contrast (WCAG)", () => {
  for (const file of files) {
    const css = readFileSync(join(THEMES_DIR, file), "utf8");
    it(`${file} declares every token Zen's :root does`, () => {
      const own = declared(css);
      expect([...ZEN_TOKENS].filter((t) => !own.has(t))).toEqual([]);
    });
    const blocks = parseBlocks(css);
    const light = blocks.find((b) => !b.selector.includes(".dark"));
    it(`${file} defines a palette`, () => {
      expect(light, "light block").toBeDefined();
      expect(Object.keys(light!.tokens).length).toBeGreaterThan(10);
    });
    for (const block of blocks) {
      const tokens = block.selector.includes(".dark") ? { ...light!.tokens, ...block.tokens } : block.tokens;
      it(`${file} ${block.selector.includes(".dark") ? "dark" : "light"} defines every slot and status token`, () => {
        expect(REQUIRED.filter((t) => !block.tokens[t])).toEqual([]);
      });
      it(`${file} ${block.selector.includes(".dark") ? "dark" : "light"} meets the minimum ratios`, () => {
        const failures: string[] = [];
        for (const [fg, bg, min, what] of PAIRS) {
          const a = tokens[fg];
          const ground = tokens[bg.replace(/^tint:/, "")];
          if (!a || !ground) continue; // derived value (rgba/color-mix) or not defined
          const b = bg.startsWith("tint:") ? tint(a, ground) : ground;
          const ratio = contrast(a, b);
          if (ratio < min)
            failures.push(`${what}: ${fg} ${a} on ${bg} ${b} = ${ratio.toFixed(2)} (< ${min})`);
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
