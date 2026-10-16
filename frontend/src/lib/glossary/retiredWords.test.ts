import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * One word per thing (doc 30 D7). These words named something that now has one name, so a
 * writer met two words for one thing. They may not come back into what LoreStudio shows:
 *
 * - "snapshot" and "auto backup" are a **version** (a saved copy of one story);
 * - "Codex graph" is **Connections** (Codex names only the Assistant's index, in Settings);
 * - "plot thread" is a **thread**;
 * - "Analyse" is **Analyze** (US English).
 *
 * The old words stay findable: palette `keywords` and a glossary entry's `alsoCalled` are
 * where they belong, and are not read. Identifiers and stored values ("snapshot", a route,
 * a guide's id) are lowercase words with no spaces, and are not read either.
 */
const RETIRED: [RegExp, string][] = [
  [/\bsnapshots?\b/i, "version"],
  [/\bauto[- ]?backups?\b/i, "version saved automatically"],
  [/\bCodex graph\b/i, "Connections"],
  [/\bplot threads?\b/i, "thread"],
  [/\banalys(e|ed|ing)\b/i, "analyze"],
];

/**
 * Genuine exceptions, as "file: the text", with the reason. Keep this short: a new entry
 * should be a word that names something else, not the thing the table renamed.
 */
const ALLOWED: string[] = [];

/** Arrays whose words are for finding things, not for showing. */
const SEARCH_ONLY = /^(keywords|alsoCalled)$/;

const SRC = join(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|md)$/.test(name) && !name.includes(".test.") && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** The strings a source file could show: its string literals, template text and JSX text. */
export function shownStrings(source: string, file = "x.tsx"): string[] {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const out: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (
      ts.isPropertyAssignment(node) &&
      SEARCH_ONLY.test(node.name.getText(sf)) &&
      ts.isArrayLiteralExpression(node.initializer)
    )
      return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text.trim();
      // An identifier, a path or a stored value: lowercase, no spaces.
      if (text && !/^[a-z0-9_./:?=&{}#-]+$/.test(text)) out.push(text.replace(/\s+/g, " "));
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

/** A guide's lines, without link targets (a guide's id may keep an old word). */
function guideLines(source: string): string[] {
  return source.split("\n").map((line) => line.replace(/\]\([^)]*\)/g, "]"));
}

function retiredIn(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const rel = relative(SRC, file);
  const texts = file.endsWith(".md") ? guideLines(source) : shownStrings(source, file);
  const hits: string[] = [];
  for (const text of texts)
    for (const [word, instead] of RETIRED)
      if (word.test(text) && !ALLOWED.includes(`${rel}: ${text}`))
        hits.push(`${rel}: "${text.slice(0, 90)}" (say "${instead}")`);
  return hits;
}

describe("retired words (doc 30 D7)", () => {
  it("finds a retired word in copy, and leaves keywords and identifiers alone", () => {
    const source = `
      const a = { label: "Create snapshot", keywords: ["snapshot", "plot thread"] };
      const b = "snapshots-and-backups";
      const c = <p>Analyse the plot threads</p>;`;
    expect(shownStrings(source)).toEqual(["Create snapshot", "Analyse the plot threads"]);
  });

  it("are not shown anywhere: one word per thing", () => {
    const hits = walk(SRC).flatMap(retiredIn);
    expect(hits).toEqual([]);
  });
});
