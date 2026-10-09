import { request } from "./request";
import type { UpdateStatus } from "../types/system";

/** Updates: kept out of client.ts (size budget). */
export const systemApi = {
  /** What was last seen; never asks GitHub. */
  updateStatus: () => request<UpdateStatus>("/system/update"),
  /** Ask GitHub now. */
  checkForUpdate: () => request<UpdateStatus>("/system/update/check", { method: "POST" }),
};
