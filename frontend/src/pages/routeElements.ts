import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { StoryRoute } from "../lib/routes";

/**
 * The page for every route in `lib/routes.ts` (refactor doc 11, phase 4), and for every
 * section of a grouped page (doc 12, phase 1). Kept apart from the routes component so fast
 * refresh and `storyRoutes.test.ts` can import it alone.
 */
export interface PageProps {
  storyId: string;
  /** The section being shown, when the page is one body behind several sections. */
  section?: string;
}
type Page = LazyExoticComponent<ComponentType<PageProps>> | LazyExoticComponent<ComponentType>;

/** Pages without sections. A grouped page is drawn by `SectionedPage` from the tables below. */
export const ROUTE_ELEMENTS: Record<StoryRoute["id"], Page> = {
  overview: lazy(() => import("./StoryOverviewPage")),
  write: lazy(() => import("../components/editor/SceneEditor")),
  plan: lazy(() => import("../components/plan/PlanPage")),
  whatif: lazy(() => import("./WhatIfPage")),
  panels: lazy(() => import("../components/panels/PanelInterviewPanel")),
  codex: lazy(() => import("./CodexPage")),
  discoveries: lazy(() => import("./DiscoveryQueuePage")),
  health: lazy(() => import("./StoryHealthPage")),
  publish: lazy(() => import("./PublishPage")),
};

const WorldBuildingHub = lazy(() => import("../components/worldbuilding/WorldBuildingHub"));
const MediaPage = lazy(() => import("./MediaPage"));
const ChroniclePage = lazy(() => import("./ChroniclePage"));

/** One body per section, keyed `route.section`. Several sections may share a body. */
export const SECTION_ELEMENTS: Record<string, Page> = {
  "lorebook.identity": lazy(() => import("../components/story/StoryIdentityPanel")),
  "lorebook.characters": lazy(() => import("../components/characters/CharacterList")),
  "lorebook.places": WorldBuildingHub,
  "lorebook.threads": lazy(() => import("../components/threads/PlotThreadManager")),
  "lorebook.twists": lazy(() => import("../components/twists/TwistManager")),
  "lorebook.systems": WorldBuildingHub,
  "lorebook.cultures": WorldBuildingHub,
  "lorebook.history": WorldBuildingHub,
  "lorebook.calendars": WorldBuildingHub,
  "lorebook.travel": WorldBuildingHub,
  "compendium.research": lazy(() => import("../components/compendium/CompendiumPanel")),
  "compendium.images": MediaPage,
  "compendium.diagrams": MediaPage,
  "chronicle.activity": ChroniclePage,
  "chronicle.conversations": ChroniclePage,
  "chronicle.changes": ChroniclePage,
  "chronicle.versions": lazy(() => import("./VersionsPage")),
};

/** The entry page under a section with a `detailParam` (a character's sheet under Characters). */
export const DETAIL_ELEMENTS: Record<string, Page> = {
  "lorebook.characters": lazy(() => import("../components/characters/CharacterSheet")),
  "lorebook.places": lazy(() => import("./LocationSheet")),
};
