import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { StoryRoute } from "../lib/routes";

/**
 * The page for every route in `lib/routes.ts` (refactor doc 11, phase 4). Kept apart
 * from the routes component so fast refresh and `storyRoutes.test.ts` can import it alone.
 */
type Page = LazyExoticComponent<ComponentType<{ storyId: string }>> | LazyExoticComponent<ComponentType>;

export const ROUTE_ELEMENTS: Record<StoryRoute["id"], Page> = {
  overview: lazy(() => import("./StoryOverviewPage")),
  write: lazy(() => import("../components/editor/SceneEditor")),
  plan: lazy(() => import("../components/plan/PlanPage")),
  threads: lazy(() => import("../components/threads/PlotThreadManager")),
  lorebook: lazy(() => import("../components/story/StoryIdentityPanel")),
  characters: lazy(() => import("../components/characters/CharacterList")),
  worldbuilding: lazy(() => import("../components/worldbuilding/WorldBuildingHub")),
  twists: lazy(() => import("../components/twists/TwistManager")),
  compendium: lazy(() => import("../components/compendium/CompendiumPanel")),
  media: lazy(() => import("./MediaPage")),
  whatif: lazy(() => import("./WhatIfPage")),
  panels: lazy(() => import("../components/panels/PanelInterviewPanel")),
  codex: lazy(() => import("./CodexPage")),
  discoveries: lazy(() => import("./DiscoveryQueuePage")),
  health: lazy(() => import("./StoryHealthPage")),
  chronicle: lazy(() => import("./ChroniclePage")),
  versions: lazy(() => import("./VersionsPage")),
  publish: lazy(() => import("./PublishPage")),
};
