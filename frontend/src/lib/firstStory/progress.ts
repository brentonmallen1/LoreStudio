import type { StepId } from "./steps";

/**
 * Where the author is in "My first story", per story and per browser: which step, which are
 * done, and what each step made, so going back edits it instead of making another. The things
 * themselves are story data; this only remembers the walkthrough.
 */
export interface Progress {
  step: number;
  done: StepId[];
  characterId?: string;
  threadId?: string;
  twistId?: string;
  sceneIds?: string[];
}

const key = (storyId: string) => `ls_first_story:${storyId}`;

export function readProgress(storyId: string): Progress {
  try {
    const raw = localStorage.getItem(key(storyId));
    if (raw) return { step: 0, done: [], ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    /* private window or blocked storage: start at the top */
  }
  return { step: 0, done: [] };
}

export function writeProgress(storyId: string, p: Progress) {
  try {
    localStorage.setItem(key(storyId), JSON.stringify(p));
  } catch {
    /* the walkthrough still works; it just won't remember */
  }
}
