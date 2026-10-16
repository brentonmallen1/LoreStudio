import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No meaning only on hover (doc 30 D8). A control hidden until the pointer is over its row
 * (`opacity: 0`, `display: none` or `visibility: hidden`, shown by `.row:hover .x`) has to
 * show as well:
 *
 * - when the keyboard is inside the row (`.row:focus-within .x`), so Tab reaches something
 *   it can see;
 * - always on a touch screen (`@media (hover: none)`), where nothing is ever hovered.
 *
 * Every module is read here, and each `:hover` that reveals must come with the other two.
 */

interface Rule {
  selectors: string[];
  body: string;
  media: string | null;
}

/** A small reader for the flat CSS these modules hold: rules, and rules inside one @media. */
export function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let i = 0;
  function block(media: string | null, end: number) {
    while (i < end) {
      const open = src.indexOf("{", i);
      if (open === -1 || open >= end) return;
      const head = src.slice(i, open).trim();
      if (head.startsWith("@")) {
        // Find the matching close of an at-rule block.
        let depth = 1;
        let j = open + 1;
        while (j < src.length && depth > 0) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
          j++;
        }
        if (/^@media/.test(head)) {
          i = open + 1;
          block(head, j - 1);
        }
        i = j;
        continue;
      }
      const close = src.indexOf("}", open);
      rules.push({
        selectors: head.split(",").map((s) => s.trim().replace(/\s+/g, " ")),
        body: src.slice(open + 1, close),
        media,
      });
      i = close + 1;
    }
  }
  block(null, src.length);
  return rules;
}

/** The classes of a selector's last compound: `.row:hover .x.y` → ["x", "y"]. */
function lastClasses(selector: string): string[] {
  const last =
    selector
      .split(/[\s>+~]+/)
      .filter(Boolean)
      .at(-1) ?? "";
  return [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

const shows = (body: string) =>
  /opacity:\s*(1|0?\.\d+)\b/.test(body) ||
  /display:\s*(?!none)[a-z-]+/.test(body) ||
  /visibility:\s*visible/.test(body);
const hides = (body: string) =>
  /opacity:\s*0\s*(;|$)/.test(body) || /display:\s*none/.test(body) || /visibility:\s*hidden/.test(body);

/** The classes hidden until hover, with what is missing for each. */
export function hoverOnly(css: string): string[] {
  const rules = parseRules(css);
  const plain = rules.filter((r) => !r.media || !/reduced-motion/.test(r.media));
  const hidden = new Set<string>();
  for (const r of plain)
    if (!r.media && hides(r.body))
      for (const s of r.selectors) {
        const cls = lastClasses(s).at(-1);
        if (cls && !/:(hover|focus|active|disabled)|\[/.test(s.split(" ").at(-1) ?? "")) hidden.add(cls);
      }
  const problems: string[] = [];
  for (const cls of hidden) {
    const on = (pred: (s: string) => boolean, inMedia: (m: string | null) => boolean) =>
      plain.some(
        (r) =>
          inMedia(r.media) &&
          shows(r.body) &&
          r.selectors.some((s) => lastClasses(s).includes(cls) && pred(s)),
      );
    const byHover = on(
      (s) => s.includes(":hover"),
      (m) => !m,
    );
    if (!byHover) continue;
    const byFocus = on(
      (s) => s.includes(":focus-within"),
      (m) => !m || !/hover:\s*none/.test(m),
    );
    const byTouch = on(
      () => true,
      (m) => !!m && /hover:\s*none/.test(m),
    );
    if (!byFocus) problems.push(`.${cls}: no :focus-within`);
    if (!byTouch) problems.push(`.${cls}: no @media (hover: none)`);
  }
  return problems;
}

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

describe("controls shown on hover (doc 30 D8)", () => {
  it("reads a pairing, and what is missing from one", () => {
    const css = `
      .x { opacity: 0; }
      .row:hover .x { opacity: 1; }
      .y { opacity: 0; }
      .row:hover .y, .row:focus-within .y { opacity: 1; }
      @media (hover: none) { .y { opacity: 1; } }
      @keyframes in { from { opacity: 0; } }`;
    expect(hoverOnly(css)).toEqual([".x: no :focus-within", ".x: no @media (hover: none)"]);
  });

  it("show on keyboard focus and on touch as well, everywhere", () => {
    const problems = walk(SRC).flatMap((file) =>
      hoverOnly(readFileSync(file, "utf8")).map((p) => `${relative(SRC, file)} ${p}`),
    );
    expect(problems).toEqual([]);
  });
});
