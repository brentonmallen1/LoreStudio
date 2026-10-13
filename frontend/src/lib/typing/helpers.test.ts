import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { slashCommandsFor } from "../editor/slashCommands";
import { HELPERS, helpersFor } from "./helpers";

/**
 * The list of typing helpers held against the code (doc 26, P1): a helper the list names but
 * nothing reports would never tick, and a slash command or picker with no helper would be
 * missing from the Typing guide and the tips.
 */

const SRC = resolve(__dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The code that reports helpers: every file that calls `markUsed`, but the store itself. */
const reporters = sources(SRC)
  .filter((path) => !path.endsWith("typingStore.ts") && !path.endsWith(join("typing", "helpers.ts")))
  .map((path) => readFileSync(path, "utf8"))
  .filter((text) => text.includes("markUsed("))
  .join("\n");

describe("typing helpers", () => {
  it("are each listed once", () => {
    const ids = HELPERS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are each reported by the code that does their work", () => {
    const silent = HELPERS.map((h) => h.id).filter((id) => !reporters.includes(`"${id}"`));
    expect(silent).toEqual([]);
  });

  it("are each offered as a tip by the code that does it the long way", () => {
    const offered = sources(SRC)
      .filter((path) => !path.endsWith("tipStore.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .filter((text) => text.includes("offerTip("))
      .join("\n");
    const withLongWay = HELPERS.filter((h) => "longWay" in h).map((h) => h.id);
    expect(withLongWay.filter((id) => !offered.includes(`offerTip("${id}")`))).toEqual([]);
  });

  it("say what to type, or which keys", () => {
    for (const h of HELPERS) expect("typed" in h || "shortcuts" in h, h.id).toBe(true);
  });

  it("cover every slash command that adds something, and the pickers the others open", () => {
    const typed = new Set(HELPERS.flatMap((h) => ("typed" in h ? [h.typed] : [])));
    for (const format of ["prose", "screenplay", "stage_play"] as const) {
      for (const cmd of slashCommandsFor(format)) {
        const a = cmd.action;
        if (a.kind === "note" || a.kind === "todo" || a.kind === "image")
          expect(typed).toContain(`/${cmd.name}`);
        if (a.kind === "type") expect(typed).toContain(a.text);
        if (a.kind === "dialogue") expect(typed).toContain("^");
      }
    }
  });

  it("are offered only where they work", () => {
    const prose = helpersFor("prose").map((h) => h.id);
    expect(prose).toContain("line");
    expect(prose).not.toContain("script-tab");
    expect(helpersFor("screenplay").map((h) => h.id)).toContain("script-heading");
    expect(helpersFor("stage_play").map((h) => h.id)).toContain("stage-marker");
    expect(helpersFor("stage_play").map((h) => h.id)).not.toContain("script-heading");
  });
});
