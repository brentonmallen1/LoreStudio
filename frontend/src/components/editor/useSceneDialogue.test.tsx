import { renderHook, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test/mocks/server";
import type { DialogueBlock } from "../../types";
import { DialogueExtension } from "../story/DialogueExtension";
import { setMentionEntries } from "../story/MentionDropdown";
import { proseStarterKit } from "./starterKit";
import { useSceneDialogue } from "./useSceneDialogue";

const TAKE = "<p>“You’re Eleanor Vance,” the woman said before the door was fully open.</p>";

function line(over: Partial<DialogueBlock>): DialogueBlock {
  return {
    id: "t2:0",
    scene_id: "s1",
    character_id: "c-margaret",
    speaker_name: "Margaret Holt",
    content: "You’re Eleanor Vance,",
    raw_text: "“You’re Eleanor Vance,”",
    paragraph_index: 0,
    position_in_paragraph: 0,
    attribution_method: "inferred",
    dialogue_type: "speech",
    confidence: 0.8,
    subtext: null,
    ...over,
  };
}

let editor: Editor | null = null;
beforeEach(() => {
  setMentionEntries([
    { kind: "character", name: "Margaret Holt", slot: 3 },
    { kind: "character", name: "Eleanor Vance", slot: 1 },
  ]);
});
afterEach(() => {
  editor?.destroy();
  editor = null;
  setMentionEntries([]);
});

describe("dialogue colors on a take that does not count", () => {
  it("reads the take's own lines, so its untagged lines carry their speaker's color", async () => {
    const asked: string[] = [];
    server.use(
      http.get("/api/takes/:id/dialogue", ({ params }) => {
        asked.push(`take:${params.id}`);
        return HttpResponse.json([line({})]);
      }),
      http.get("/api/scenes/:id/dialogue", ({ params }) => {
        asked.push(`scene:${params.id}`);
        return HttpResponse.json([]);
      }),
    );
    editor = new Editor({ extensions: [proseStarterKit(), DialogueExtension], content: TAKE });
    renderHook(() => useSceneDialogue(editor, "s1", "2026-10-16T10:00:00", "t2"));
    await waitFor(() => expect(editor!.view.dom.querySelector('[data-speaker-slot="3"]')).not.toBeNull());
    expect(asked).toEqual(["take:t2"]);
    expect(editor.view.dom.querySelector('[data-speaker-slot="3"]')?.textContent).toBe(
      "“You’re Eleanor Vance,”",
    );
  });

  it("reads the scene's lines when the take open is the one that counts", async () => {
    const asked: string[] = [];
    server.use(
      http.get("/api/scenes/:id/dialogue", ({ params }) => {
        asked.push(`scene:${params.id}`);
        return HttpResponse.json([]);
      }),
    );
    editor = new Editor({ extensions: [proseStarterKit(), DialogueExtension], content: TAKE });
    renderHook(() => useSceneDialogue(editor, "s1", "2026-10-16T10:00:00"));
    await waitFor(() => expect(asked).toEqual(["scene:s1"]));
  });
});
