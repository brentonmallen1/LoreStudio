import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Anything a writer can press looks pressable at rest (DESIGN.md §5, the Pressable Rule).
 * A text action inside content is the secondary button, `.btn-secondary` in index.css: the
 * button ground (the vellum) at rest, deep vellum under the pointer. A CSS module takes it
 * with `composes: btn-secondary from global;` and keeps only its layout, so nothing it
 * declares can take the ground away again.
 */

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".module.css")) out.push(path);
  }
  return out;
}

/** Flat rules (selector list and body), comments gone; enough for these modules. */
function rules(css: string): { selectors: string[]; body: string }[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1]
      .trim()
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " ")),
    body: m[2],
  }));
}

const COMPOSES = /composes:\s*btn-secondary from global/;

/** Classes that compose the secondary button, and anything else in the file that undoes it. */
export function undoesSecondary(css: string): string[] {
  const all = rules(css);
  const composed = all
    .filter((r) => COMPOSES.test(r.body))
    .flatMap((r) => r.selectors.map((s) => s.match(/^\.([\w-]+)$/)?.[1] ?? `!${s}`));
  const problems = composed
    .filter((c) => c.startsWith("!"))
    .map((c) => `${c.slice(1)}: composes needs one class`);
  for (const cls of composed.filter((c) => !c.startsWith("!"))) {
    // The class itself, or the class in a state (:hover, [data-ai], :disabled), not inside
    // something else: a box may still set the button's tokens for what sits in it.
    const own = new RegExp(`^\\.${cls}(?![\\w-])(:[\\w-]+(\\([^)]*\\))?|\\[[^\\]]*\\])*$`);
    for (const r of all)
      for (const s of r.selectors) {
        if (!own.test(s)) continue;
        if (/(^|;)\s*background(-color)?\s*:/.test(r.body)) problems.push(`${s}: sets a background`);
        if (/(^|;)\s*border(-color)?\s*:\s*(?!none)/.test(r.body)) problems.push(`${s}: outlined`);
        if (/(^|;)\s*opacity\s*:/.test(r.body) && /:disabled/.test(s))
          problems.push(`${s}: quiet by opacity`);
      }
  }
  return problems;
}

describe("things you can press look pressable (DESIGN.md §5)", () => {
  const index = readFileSync(join(SRC, "index.css"), "utf8");
  const base = readFileSync(join(SRC, "themes", "base.css"), "utf8");

  it("gives the secondary button a ground at rest, from tokens", () => {
    const rest = rules(index).find((r) => r.selectors.includes(".btn-secondary"));
    expect(rest?.body).toMatch(/background:\s*var\(--color-button\)/);
    expect(base).toMatch(/--color-button:\s*var\(--color-surface-2\)/);
    expect(base).toMatch(/--color-button-hover:\s*var\(--color-surface-3\)/);
    const hover = rules(index).find((r) => r.selectors.includes(".btn-secondary:hover:not(:disabled)"));
    expect(hover?.body).toMatch(/background:\s*var\(--color-button-hover\)/);
  });

  it("reads a module that takes the ground away again", () => {
    const css = `
      .a { composes: btn-secondary from global; margin: 0; }
      .a:hover { background: transparent; }
      .row .a { color: red; }
      .b { composes: btn-secondary from global; border: 1px solid var(--color-border); }
      .b:disabled { opacity: 0.5; }`;
    expect(undoesSecondary(css)).toEqual([
      ".a:hover: sets a background",
      ".b: outlined",
      ".b:disabled: quiet by opacity",
    ]);
  });

  it("no module undoes the secondary button it composes", () => {
    const problems = walk(SRC).flatMap((f) =>
      undoesSecondary(readFileSync(f, "utf8")).map((p) => `${relative(SRC, f)} ${p}`),
    );
    expect(problems).toEqual([]);
  });

  // The ones Brenton found reading as plain text, and the sweep after (2026-10-16): each stays
  // a secondary button.
  it.each([
    ["components/findings/Findings.module.css", ["verb", "no"]],
    ["components/ai/kept/KeptAnswerBar.module.css", ["talk", "quiet"]],
    ["components/lorebook/assistant/Assistant.module.css", ["talk", "quiet"]],
    ["components/chronicle/versions/Versions.module.css", ["snapBtn", "deleteConfirmNo"]],
    ["components/layout/jobs/Jobs.module.css", ["action"]],
    ["components/overview/Overview.module.css", ["heroAction", "nextScene"]],
    ["components/plan/Plan.module.css", ["addRow"]],
    ["components/lorebook/Lorebook.module.css", ["quietBtn"]],
  ])("%s keeps its text actions pressable", (file, classes) => {
    const css = readFileSync(join(SRC, file), "utf8");
    const composed = rules(css)
      .filter((r) => COMPOSES.test(r.body))
      .flatMap((r) => r.selectors.map((s) => s.slice(1)));
    for (const c of classes) expect(composed).toContain(c);
  });
});
