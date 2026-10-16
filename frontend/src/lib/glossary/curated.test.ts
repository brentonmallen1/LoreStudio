import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { glossaryEntry } from "./index";
import { markedTerms } from "./markup";

/**
 * No tool assumes craft training (doc 30 D1). These words are the ones a writer without a
 * course behind them stops at, so a page that shows one explains it: somewhere in the same
 * file the word is a `Term`, or, in copy kept as data, a `{{term:id}}` mark. Once per file is
 * enough; a book defines a word once, not every time it uses it.
 *
 * The list is short on purpose. Add a word when the glossary gains it and it shows up bare.
 */
const CURATED: [RegExp, string][] = [
  [/\blogline/i, "logline"],
  [/\bdeuteragonist/i, "deuteragonist"],
  [/\barchetype/i, "archetype"],
  [/\bepiphan(y|ies)\b/i, "epiphany"],
  [/\bMICE\b/, "mice"],
  [/\bbeat sheets?\b/i, "beat-sheet"],
  [/\btry[/-]fail/i, "try-fail"],
  [/\bdramatic irony\b/i, "dramatic-irony"],
  [/\bsaid-bookisms?\b/i, "said-bookism"],
  [/\bred herrings?\b/i, "red-herring"],
  [/\bpinch points?\b/i, "pinch-point"],
  [/\binciting incident/i, "inciting-incident"],
];

/** Copy kept as data and drawn through `TermText`. */
const DATA_FILES = ["lib/planning/methods.ts"];

const SRC = join(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") && !name.includes(".test.")) out.push(path);
  }
  return out;
}

function tagName(node: ts.Node): string | null {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  return null;
}

/** The words a component shows: its JSX text, and string literals written as a JSX child. */
export function shownText(source: string, file = "x.tsx"): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  function visit(node: ts.Node) {
    if (tagName(node) === "Term") return; // the word inside a Term is explained
    if (ts.isJsxText(node) && node.text.trim()) out.push(node.text);
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
    )
      out.push(node.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

/** The properties of a data file that are shown as words. */
const SHOWN_PROPS = new Set(["label", "summary", "why", "how", "example", "placeholder"]);

/** The shown strings of a data file: `why: "…"`, `how: "…"`, and the like. */
function dataText(source: string): string[] {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      SHOWN_PROPS.has(node.name.getText()) &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    )
      out.push(node.initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

/** The term ids a file explains: `<Term id="x">` and `{{term:x}}`. */
function explained(source: string): Set<string> {
  const ids = [...source.matchAll(/<Term\s+id=["']([a-z0-9-]+)["']/g)].map((m) => m[1]);
  return new Set([...ids, ...markedTerms(source)]);
}

/** The curated words a file shows bare, as `file: word`. */
export function bareWords(source: string, shown: string[], file: string): string[] {
  const have = explained(source);
  const plain = shown.map((t) => t.replace(/\{\{term:[^}]+\}\}/g, ""));
  return CURATED.filter(([re, id]) => !have.has(id) && plain.some((t) => re.test(t))).map(
    ([, id]) => `${file}: ${id}`,
  );
}

describe("craft words explain themselves", () => {
  it("finds a bare word, and accepts one shown through Term once in the file", () => {
    const bare = `export const A = () => <p>Write your logline.</p>;`;
    expect(bareWords(bare, shownText(bare), "a")).toEqual(["a: logline"]);
    const told = `export const A = () => <p>Your <Term id="logline">logline</Term>. Then the logline again.</p>;`;
    expect(bareWords(told, shownText(told), "a")).toEqual([]);
    const props = `export const A = () => <input placeholder="logline" />;`;
    expect(shownText(props)).toEqual([]);
  });

  // It parses every page and component: about a second alone, but past vitest's 5s default under
  // coverage with the other suites running beside it, as on CI.
  it("in every page and component", { timeout: 30_000 }, () => {
    const bare: string[] = [];
    for (const path of [...walk(join(SRC, "components")), ...walk(join(SRC, "pages"))]) {
      const source = readFileSync(path, "utf8");
      bare.push(...bareWords(source, shownText(source, path), relative(SRC, path)));
    }
    expect(bare).toEqual([]);
  });

  it("in copy kept as data", () => {
    const bare: string[] = [];
    for (const file of DATA_FILES) {
      const source = readFileSync(join(SRC, file), "utf8");
      bare.push(...bareWords(source, dataText(source), file));
    }
    expect(bare).toEqual([]);
  });

  it("marks only words the glossary has", () => {
    const unknown: string[] = [];
    for (const path of [
      ...walk(join(SRC, "components")),
      ...walk(join(SRC, "pages")),
      ...DATA_FILES.map((f) => join(SRC, f)),
    ]) {
      const source = readFileSync(path, "utf8");
      for (const id of explained(source))
        if (!glossaryEntry(id)) unknown.push(`${relative(SRC, path)}: ${id}`);
    }
    expect(unknown).toEqual([]);
  });
});
