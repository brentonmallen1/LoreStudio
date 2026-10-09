import { useContext, useMemo } from "react";
import {
  Route,
  Routes,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_RouteContext as RouteContext,
  createPath,
  parsePath,
  type Navigator,
  type To,
} from "react-router-dom";
import StoryRoutes from "../../pages/storyRoutes";
import { staysInPage, storyRelative } from "../../lib/panel/pages";
import { navigateMain } from "../../lib/panel/panelSync";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelTab } from "../../types/panel";
import { InPanelPage } from "./inPanelPage";
import styles from "./Panel.module.css";

type PageTabState = Extract<PanelTab, { kind: "page" }>;

/**
 * A page beside the prose (doc 24 D2): the story's own routes, drawn against the tab's
 * address instead of the window's, in the panel's narrow container (pages fold by container
 * query, as they do in a narrow window). A move inside the page (a section, an entry) stays
 * in the tab; a move anywhere else (a Storyboard card to its scene) is the main window's.
 */
export default function PageTab({ tab }: { tab: PageTabState }) {
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const setPagePath = usePanelStore((s) => s.setPagePath);
  const parent = useContext(NavigationContext);

  const navigation = useMemo(() => {
    const route = (to: To, replace: boolean) => {
      const path = typeof to === "string" ? parsePath(to) : to;
      const rel = storyId ? storyRelative(storyId, path.pathname ?? "") : null;
      if (rel !== null && staysInPage(tab.routeId, rel)) {
        setPagePath(tab.id, createPath({ ...path, pathname: rel || "/" }));
        return true;
      }
      if (!replace) navigateMain(createPath(path));
      return false;
    };
    const base = parent.navigator;
    const navigator: Navigator = {
      createHref: (to) => base.createHref(to),
      encodeLocation: base.encodeLocation ? (to) => base.encodeLocation!(to) : undefined,
      go: (delta) => base.go(delta),
      push: (to) => void route(to, false),
      // A page that tidies its own address (a redirect, a replaced query) does it in the tab.
      replace: (to) => void route(to, true),
    };
    return { ...parent, navigator };
  }, [parent, storyId, tab.id, tab.routeId, setPagePath]);

  if (!storyId) return null;
  const location = parsePath(`/stories/${storyId}${tab.path === "/" ? "" : tab.path}`);

  return (
    <div className={styles.page}>
      <InPanelPage.Provider value={tab}>
        <NavigationContext.Provider value={navigation}>
          {/* From the router's root, so it matches the same in the pop-out window. */}
          <RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
            <Routes location={location}>
              <Route path="/stories/:storyId/*" element={<StoryRoutes />} />
            </Routes>
          </RouteContext.Provider>
        </NavigationContext.Provider>
      </InPanelPage.Provider>
    </div>
  );
}
