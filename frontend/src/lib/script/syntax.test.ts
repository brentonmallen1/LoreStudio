import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyLine,
  clean,
  cueName,
  eighths,
  formatSlugline,
  headingAt,
  ENTER_NEXT,
  formatEighths,
  LAYOUT,
  LINES_PER_PAGE,
  pageCount,
  paginate,
  parseCue,
  parseLines,
  parseSlugline,
  shotOf,
  sceneLines,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  wrap,
  type Block,
  type Line,
  type Page,
  DUAL_COLUMN,
  DUAL_LAYOUT,
  DUAL_RIGHT,
  STAGE_LAYOUT,
  type ScriptElement,
} from "./syntax";

// The same cases the server's tests run (backend/tests/services/test_script_syntax.py).
const CASES = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/script-syntax/cases.json"), "utf8"),
) as {
  layout: unknown;
  next: unknown;
  classify: [string, ScriptElement | null, ScriptElement][];
  clean: [ScriptElement, string, string][];
  cue: [string, string, string[], boolean][];
  cue_names: [string, string][];
  parse: { text: string; expect: Block[] }[];
  wrap: [string, number, number, string[]][];
  paginate: { _why: string; blocks: Block[]; pages: string[][] }[];
  scene_lines: [Block[], number, number][];
  slugline: [string, string, string, string, string][];
  heading_at: [Block[], number][];
  stage_classify: [string, ScriptElement | null, ScriptElement][];
  stage_paginate: { _why: string; blocks: Block[]; pages: string[][]; lines: number }[];
};

const line = (l: Line | null | undefined) => (l ? `${l.element}|${l.x}|${l.text}` : "");
/** Each row as 'element|x|text', and ' || ' the line beside it (dual dialogue). */
const show = (pages: Page[]) =>
  pages.map((p) => p.lines.map((l, row) => line(l) + (p.beside[row] ? ` || ${line(p.beside[row])}` : "")));

describe("script grammar (shared cases)", () => {
  it("lays elements out where the server does", () => {
    expect(CASES.layout).toEqual({
      lines_per_page: LINES_PER_PAGE,
      elements: LAYOUT,
      dual: { column: DUAL_COLUMN, right: DUAL_RIGHT, elements: DUAL_LAYOUT },
      stage: STAGE_LAYOUT,
    });
    expect(CASES.next).toEqual({ enter: ENTER_NEXT, tab: TAB_NEXT, shift_tab: SHIFT_TAB_NEXT });
  });

  it.each(CASES.classify)("classifies %j after %s", (text, prev, expected) => {
    expect(classifyLine(text, prev)).toBe(expected);
  });

  it.each(CASES.clean)("cleans a %s: %j", (element, text, expected) => {
    expect(clean(element, text)).toBe(expected);
  });

  it.each(CASES.cue)("reads the cue %j", (text, name, extensions, dual) => {
    expect(parseCue(text)).toEqual({ name, extensions, dual });
  });

  it.each(CASES.parse)("parses Fountain text %#", ({ text, expect: blocks }) => {
    expect(parseLines(text)).toEqual(blocks);
  });

  it.each(CASES.slugline)("reads the heading %j", (text, interior, place, time, printed) => {
    const slug = parseSlugline(text);
    expect(slug).toEqual({ interior, place, time });
    expect(formatSlugline(slug)).toBe(printed);
  });

  it.each(CASES.heading_at)("finds the scene's own heading in %j", (blocks, at) => {
    expect(headingAt(blocks)).toBe(at);
  });

  it.each(CASES.stage_classify)("classifies %j after %s in a play", (text, prev, expected) => {
    expect(classifyLine(text, prev, "stage_play")).toBe(expected);
  });

  it.each(CASES.stage_paginate)("lays out a play: $_why", ({ blocks, pages, lines }) => {
    expect(show(paginate(blocks, 20, "stage_play"))).toEqual(pages);
    expect(sceneLines(blocks, "stage_play")).toBe(lines);
  });

  it.each(CASES.wrap)("wraps %j at %i", (text, width, hang, lines) => {
    expect(wrap(text, width, hang)).toEqual(lines);
  });

  it.each(CASES.paginate)("paginates: $_why", ({ blocks, pages }) => {
    expect(show(paginate(blocks, 10))).toEqual(pages);
  });

  it.each(CASES.scene_lines)("measures a scene %#", (blocks, lines, n) => {
    expect(sceneLines(blocks)).toBe(lines);
    expect(eighths(lines)).toBe(n);
  });

  it("runs a long scene to its pages", () => {
    expect(pageCount([])).toBe(0);
    expect(pageCount([["action", "word ".repeat(3000)]])).toBe(5);
  });

  it.each(CASES.cue_names)("cues %s as %s", (name, cue) => {
    expect(cueName(name)).toBe(cue);
  });

  it("writes a length the way a breakdown does", () => {
    expect(formatEighths(3)).toBe("3/8 page");
    expect(formatEighths(8)).toBe("1 page");
    expect(formatEighths(13)).toBe("1 5/8 pages");
    expect(formatEighths(0)).toBe("");
  });

  it("says inside or out, and when, as a glance shows them", () => {
    expect(shotOf({ interior: "INT/EXT", time_of_day: "NIGHT" })).toBe("INT./EXT. · NIGHT");
    expect(shotOf({ interior: "EXT", time_of_day: "" })).toBe("EXT.");
    expect(shotOf({})).toBeNull();
  });
});
