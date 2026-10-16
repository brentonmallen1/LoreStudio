import type { Story } from "../../types";

/** The genre the tutorial stories are made with (backend services/tutorial.py, `make`). */
export const TUTORIAL_GENRE = "Tutorial";

/** A tutorial story: Learn LoreStudio or Learn Screenplays, or a fresh copy of one. */
export function isTutorial(story: Pick<Story, "genre">): boolean {
  return story.genre === TUTORIAL_GENRE;
}

/** The books New Story offers to follow: a sequel to a lesson makes no sense. */
export function sequelCandidates<S extends Pick<Story, "genre">>(stories: S[]): S[] {
  return stories.filter((s) => !isTutorial(s));
}
