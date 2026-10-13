import { request } from "./request";
import type { UpdateStatus } from "../types/system";

/** One sample (doc 26, P7): whether this library has it, and what loading it loads first. */
export interface Sample {
  title: string;
  loaded: boolean;
  needs: string[];
}

/** Every sample, and the ones this account does not have yet. */
export interface ExampleStories {
  available: boolean;
  missing: string[];
  samples: Sample[];
}

/** Updates and the example stories: kept out of client.ts (size budget). */
export const systemApi = {
  /** What was last seen; never asks GitHub. */
  updateStatus: () => request<UpdateStatus>("/system/update"),
  /** Ask GitHub now. */
  checkForUpdate: () => request<UpdateStatus>("/system/update/check", { method: "POST" }),
  exampleStories: () => request<ExampleStories>("/system/examples"),
  /** Loads the samples named, or every one missing; the titles added, and the list again. */
  addExampleStories: (titles?: string[]) =>
    request<ExampleStories & { added: string[] }>("/system/examples", {
      method: "POST",
      body: JSON.stringify(titles ? { titles } : {}),
    }),
  /** The tutorial stories, made the first time an account asks (doc 26, P6); the titles made. */
  ensureTutorial: () => request<{ made: string[] }>("/system/tutorial", { method: "POST" }),
  /** A fresh copy of one tutorial story (Guides › Start the tutorial again). */
  restartTutorial: (kind: "prose" | "screenplay") =>
    request<{ story_id: string; title: string }>("/system/tutorial/restart", {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
};
