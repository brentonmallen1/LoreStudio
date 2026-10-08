import { describe, expect, it } from "vitest";
import { EMPTY_TIMELINE, act, forget, nextRedo, nextUndo, redid, undid, type Step } from "./timeline";

const typing = (nodeId = "a", session = 1): Step => ({ kind: "editor", nodeId, session });
const change = (batch: string): Step => ({ kind: "server", batch });
const all = () => true;

describe("the undo timeline", () => {
  it("takes back the last thing done, whichever history holds it", () => {
    let t = act(act(act(EMPTY_TIMELINE, typing()), change("rename")), typing());
    const first = nextUndo(t, all).step!;
    expect(first.kind).toBe("editor");
    t = undid(t, first);
    const second = nextUndo(t, all).step!;
    expect(second).toEqual(change("rename"));
    t = undid(t, second);
    expect(nextRedo(t, all).step).toEqual(change("rename"));
  });

  it("passes over typing whose scene is closed or whose history was reset", () => {
    const t = act(act(EMPTY_TIMELINE, change("add")), typing("a", 1));
    const live = (s: Step) => s.kind === "server" || (s.nodeId === "b" && s.session === 2);
    const { step, timeline } = nextUndo(t, live);
    expect(step).toEqual(change("add"));
    expect(timeline.done).toEqual([change("add")]);
  });

  it("is empty when nothing is live, so the server's own history can answer", () => {
    expect(nextUndo(act(EMPTY_TIMELINE, typing()), () => false).step).toBeNull();
  });

  it("a new action clears redo, and says the timeline has been touched", () => {
    let t = act(EMPTY_TIMELINE, change("x"));
    t = undid(t, nextUndo(t, all).step!);
    expect(t.undone).toHaveLength(1);
    t = act(t, typing());
    expect(t.undone).toEqual([]);
    expect(t.touched).toBe(true);
    expect(EMPTY_TIMELINE.touched).toBe(false);
  });

  it("redo puts a step back where it was", () => {
    let t = act(act(EMPTY_TIMELINE, change("x")), typing());
    t = undid(t, nextUndo(t, all).step!);
    t = redid(t, nextRedo(t, all).step!);
    expect(t.done).toEqual([change("x"), typing()]);
    expect(t.undone).toEqual([]);
  });

  it("a fallback undo (from before this page) still lands on the redo side", () => {
    const fallback: Step = { kind: "server", batch: null };
    const t = undid(EMPTY_TIMELINE, fallback);
    expect(t.undone).toEqual([fallback]);
  });

  it("forgets a change undone elsewhere, by its batch or the latest", () => {
    const t = act(act(act(EMPTY_TIMELINE, change("a")), typing()), change("b"));
    expect(forget(t, "a").done).toEqual([typing(), change("b")]);
    const toast = forget(t, null, { toRedo: true });
    expect(toast.done).toEqual([change("a"), typing()]);
    expect(toast.undone).toEqual([change("b")]);
    expect(forget(t, "nope")).toBe(t);
  });
});
