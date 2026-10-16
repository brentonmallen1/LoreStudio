import { toolsApi } from "../../api/tools";
import { lessonOf } from "../typing/lesson";
import { useAuthStore } from "../../stores/authStore";
import type { StructureNode } from "../../types";

type Settings =
  { tutorial?: { prose?: string; screenplay?: string }; ui?: { start_here?: string } } | undefined;

/** The prose tutorial's id, while the account has one and Start here has not been used. */
export function startHereStory(settings: unknown): string | null {
  const s = settings as Settings;
  if (s?.ui?.start_here === "done") return null;
  return s?.tutorial?.prose ?? null;
}

const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** A count as a word, the way the copy says it ("nine short lessons"). */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** The tutorial's topics in order (its numbered sections), how many lessons (scenes) it has,
 *  and lesson 1's scene: lesson 1 itself, not the scene edited last. */
export function tutorialOutline(nodes: StructureNode[]): {
  topics: string[];
  lessons: number;
  first: string | null;
} {
  const topics = [...nodes]
    .filter((n) => !n.parent_id)
    .sort((a, b) => a.position - b.position)
    .map((n) => n.title.replace(/^\d+\.\s*/, ""));
  let first: string | null = null;
  let lowest = Infinity;
  let lessons = 0;
  const walk = (list: StructureNode[]) => {
    for (const n of list) {
      const number = lessonOf(n)?.number;
      if (typeof number === "number") {
        lessons += 1;
        if (number < lowest) {
          lowest = number;
          first = n.id;
        }
      }
      walk(n.children ?? []);
    }
  };
  walk(nodes);
  return { topics, lessons, first };
}

/** Start here has done its job: used, put away, or the tutorial opened some other way. */
export async function startHereDone(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user || startHereStory(user.settings) === null) return;
  try {
    useAuthStore.setState({ user: await toolsApi.updateMe({ settings: { ui: { start_here: "done" } } }) });
  } catch {
    /* offline: it shows again next time, which does no harm */
  }
}

/** A story opened: if it is a tutorial, Start here has nothing left to offer. */
export function noteStoryOpened(storyId: string): void {
  const s = useAuthStore.getState().user?.settings as Settings;
  if (s?.ui?.start_here === "done") return;
  if (storyId === s?.tutorial?.prose || storyId === s?.tutorial?.screenplay) void startHereDone();
}
