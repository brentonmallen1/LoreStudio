import { usePanelStore } from "../../stores/panelStore";
import { useUIStore } from "../../stores/uiStore";
import { sidesCollapsed, toggleSides, type Sides } from "./sides";

let remembered: Sides | null = null;

/** Collapse or restore the strip and the side panel together, from anywhere. */
export function toggleBothSides(): void {
  const ui = useUIStore.getState();
  const panel = usePanelStore.getState();
  const { next, remember } = toggleSides({ strip: ui.stripWidth, panelOpen: panel.open }, remembered);
  remembered = remember;
  ui.setStripWidth(next.strip);
  panel.setOpen(next.panelOpen);
}

export function useSides(): { collapsed: boolean; toggle: () => void } {
  const strip = useUIStore((s) => s.stripWidth);
  const panelOpen = usePanelStore((s) => s.open);
  return { collapsed: sidesCollapsed({ strip, panelOpen }), toggle: toggleBothSides };
}
