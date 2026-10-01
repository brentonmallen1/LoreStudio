import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Decision D11: `lib/keyboard/shortcuts.ts` is the only place a key combination is
 * written down. A title string that claims ⌘⇧T is a promise the app does not keep — two
 * of them survived Stage 2 (Show/Tell and Audience), and the palette advertised ⌘⇧I for
 * the interview picker while the table had given ⌘⇧I to Insert image.
 *
 * Comments may mention a combo; rendered text may not. Guides write `{{key:id}}`.
 */
const SRC = join(__dirname, "..", "..");
const ALLOWED = ["lib/keyboard/shortcuts.ts"];
const COMBO = /[⌘⌥⇧⌃]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|md)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

/** Strip comments — prose may name a combo; rendered text may not. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("keyboard combos", () => {
  it("are never written into a component, only read from SHORTCUTS", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const relative = file.slice(SRC.length + 1);
      if (ALLOWED.some((a) => relative.endsWith(a))) continue;
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          if (COMBO.test(line)) offenders.push(`${relative}:${i + 1} ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
