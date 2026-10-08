import { createWindowChannel } from "../sync/windowChannel";

/** Components that keep their own copy of story data listen for this and reload. */
export const UNDO_APPLIED_EVENT = "ls:undo-applied";

/**
 * A change recorded from another of this app's windows (the popped-out panel): a step on
 * this window's timeline too, in the moment it happened.
 */
export const changeChannel = createWindowChannel<{ story: string; batch: string }>("ls-changes");
