import { useEffect } from "react";
import { create } from "zustand";

/**
 * Who shows focus mode's way out. GlobalLayout pins it to the window's corner; the prose's
 * status corner holds it beside the save light instead (doc 24 D6), so the two never sit on
 * top of each other. A count, so a second host mounting before the first unmounts is fine.
 */
export const useFocusExitHost = create<{ hosts: number }>(() => ({ hosts: 0 }));

/** Call from a component that draws the way out of focus mode itself. */
export function useHostFocusExit(): void {
  useEffect(() => {
    useFocusExitHost.setState((s) => ({ hosts: s.hosts + 1 }));
    return () => useFocusExitHost.setState((s) => ({ hosts: s.hosts - 1 }));
  }, []);
}
