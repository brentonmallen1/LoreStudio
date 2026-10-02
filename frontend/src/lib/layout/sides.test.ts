import { describe, expect, it } from "vitest";
import { PANEL_ROOM_PX, panelStartsOpen } from "./sides";

describe("panelStartsOpen", () => {
  it("keeps the author's choice on a wide window", () => {
    expect(panelStartsOpen(true, 1440)).toBe(true);
    expect(panelStartsOpen(false, 1440)).toBe(false);
  });

  it("starts shut when the panel would squeeze the prose", () => {
    expect(panelStartsOpen(true, PANEL_ROOM_PX - 1)).toBe(false);
  });
});
