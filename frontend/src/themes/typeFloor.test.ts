import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The text floor (doc 17, D4): nothing in the interface is set below 11px at the Default
 * interface size. `--text-xs` (0.73rem) is the smallest size; px and smaller rem values
 * fail here. `em` is left alone (it follows its parent), and so are the SVG graphs, whose
 * labels sit in fixed shapes and zoom with the graph.
 */

const SRC = join(__dirname, "..");
const MIN_REM = 0.73;
const MIN_PX = 11;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(css|tsx)$/.test(name) && !name.includes(".test.")) out.push(path);
  }
  return out;
}

function tooSmall(file: string, text: string): string[] {
  const found: string[] = [];
  const patterns = file.endsWith(".css")
    ? [/font-size\s*:\s*(\d*\.?\d+)(rem|px)/g, /--text-[a-z]+\s*:\s*(\d*\.?\d+)(rem|px)/g]
    : [/fontSize:\s*"(\d*\.?\d+)(rem|px)"/g];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const v = Number(m[1]);
      if ((m[2] === "rem" && v < MIN_REM) || (m[2] === "px" && v < MIN_PX)) {
        const line = text.slice(0, m.index).split("\n").length;
        found.push(`${relative(SRC, file)}:${line} ${m[0]}`);
      }
    }
  }
  return found;
}

describe("text floor", () => {
  it("sets no interface text below 11px", () => {
    const offenders = walk(SRC).flatMap((f) => tooSmall(f, readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
