import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Character, CharacterRelationship } from "../../../types";

const api = vi.hoisted(() => ({
  getRelationshipTemplates: vi.fn(async () => []),
  updateRelationship: vi.fn(async (id: string, payload: object) => ({ id, ...payload })),
  createRelationship: vi.fn(),
}));
vi.mock("../../../api/client", () => ({ api }));

const { default: RelationshipEditor } = await import("./RelationshipEditor");

const cast = [
  { id: "c1", name: "Eleanor Vance", story_id: "" },
  { id: "c2", name: "Tom Hale", story_id: "" },
] as unknown as Character[];

const relationship = {
  id: "r1",
  character_id: "c1",
  related_character_id: "c2",
  relationship_type: "ally",
  description: "",
  strength: { trust: 5, power: 5, affection: 5, tension: 5, openness: 5 },
  visibility: "public",
  narrative_purpose: [],
  notes: "",
} as unknown as CharacterRelationship;

describe("a relationship's narrative purpose", () => {
  it("is optional: a relationship with none saves", async () => {
    const onSaved = vi.fn();
    render(
      <RelationshipEditor
        characterId="c1"
        characters={cast}
        relationship={relationship}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByText(/\(optional\)/)).toBeTruthy();
    expect(screen.getByText("What it's for")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.updateRelationship).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ narrative_purpose: [] }),
    );
    expect(screen.queryByText(/narrative purpose is required/i)).toBeNull();
  });
});
