import { createContext, useContext } from "react";
import type { PanelTab } from "../../types/panel";

/** Set while a page is drawn beside the prose in the side panel (doc 24 D2). */
export const InPanelPage = createContext<Extract<PanelTab, { kind: "page" }> | null>(null);

/** The page tab this is drawn in, or null on the page itself. */
export function useInPanelPage() {
  return useContext(InPanelPage);
}
