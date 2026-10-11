import { request } from "./request";
import type { UpdateStatus } from "../types/system";

/** Which example stories this account could add (only the admin account the app made can). */
export interface ExampleStories {
  available: boolean;
  missing: string[];
}

/** Updates and the example stories: kept out of client.ts (size budget). */
export const systemApi = {
  /** What was last seen; never asks GitHub. */
  updateStatus: () => request<UpdateStatus>("/system/update"),
  /** Ask GitHub now. */
  checkForUpdate: () => request<UpdateStatus>("/system/update/check", { method: "POST" }),
  exampleStories: () => request<ExampleStories>("/system/examples"),
  /** Adds what is missing; the titles added, and what is still missing. */
  addExampleStories: () =>
    request<{ added: string[]; missing: string[] }>("/system/examples", { method: "POST" }),
};
