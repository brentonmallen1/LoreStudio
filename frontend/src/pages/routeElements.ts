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
  health: lazy(() => import("./FindingsPage")),
  publish: lazy(() => import("./PublishPage")),
};

const world = () => import("../components/lorebook/sections/WorldSections");
/** One named export of the world sections, as a lazy page. */
const worldSection = (name: "SystemsSection" | "CulturesSection" | "CalendarsSection" | "TravelSection") =>
  lazy<ComponentType<PageProps>>(() => world().then((m) => ({ default: m[name] })));
const MediaPage = lazy(() => import("./MediaPage"));
const ChroniclePage = lazy(() => import("./ChroniclePage"));

/** One body per section, keyed `route.section`. Several sections may share a body. */
export const SECTION_ELEMENTS: Record<string, Page> = {
  "lorebook.identity": lazy(() => import("../components/story/StoryIdentityPanel")),
  "lorebook.characters": lazy(() => import("../components/lorebook/sections/CharactersSection")),
  "lorebook.places": lazy(() => import("../components/lorebook/sections/PlacesSection")),
  "lorebook.threads": lazy(() => import("../components/lorebook/sections/ThreadsSection")),
  "lorebook.twists": lazy(() => import("../components/lorebook/sections/TwistsSection")),
  "lorebook.systems": worldSection("SystemsSection"),
  "lorebook.cultures": worldSection("CulturesSection"),
  "lorebook.history": lazy(() => import("../components/lorebook/sections/HistorySection")),
  "lorebook.calendars": worldSection("CalendarsSection"),
  "lorebook.travel": worldSection("TravelSection"),
  "compendium.research": lazy(() => import("../components/compendium/CompendiumPanel")),
  "compendium.images": MediaPage,
  "compendium.diagrams": MediaPage,
  "chronicle.activity": ChroniclePage,
  "chronicle.conversations": ChroniclePage,
  "chronicle.changes": ChroniclePage,
  "chronicle.versions": lazy(() => import("./VersionsPage")),
};
