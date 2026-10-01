import type { ComponentType, LazyExoticComponent } from "react";
import { Route, Routes } from "react-router-dom";
import BrowserShell from "../components/layout/shapes/BrowserShell";
import ModeGate from "../components/layout/ModeGate";
import { useAIAvailable, useMode } from "../lib/mode";
import { sectionModes, sectionPath, type RouteSection, type StoryRoute } from "../lib/routes";
import { SECTION_ELEMENTS, type PageProps } from "./routeElements";
import styles from "./StoryWorkspace.module.css";

type Body = LazyExoticComponent<ComponentType<PageProps>>;

/** The groups inside an index: a divider before each of these (the Lorebook's world). */
const GAP_BEFORE = new Set(["lorebook.systems", "compendium.images", "chronicle.versions"]);

/**
 * A grouped page (doc 12 P1): the index of its sections, and the open section's body,
 * which reads the entry it shows from the address. A section outside the current mode is not listed; its
 * address still answers, with the mode notice, so a link never dead-ends.
 */
export default function SectionedPage({ route, storyId }: { route: StoryRoute; storyId: string }) {
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const sections = route.sections ?? [];
  const visible = sections.filter((s) => {
    const { modes, ai } = sectionModes(route, s);
    return modes.includes(mode) && (!ai || aiAvailable);
  });

  const gate = (section: RouteSection, node: React.ReactNode) => {
    const { modes, ai } = sectionModes(route, section);
    if (modes.length === 2 && !ai) return node;
    return <ModeGate route={{ ...route, label: section.label, modes, ai }}>{node}</ModeGate>;
  };

  return (
    <BrowserShell
      title={route.label}
      items={visible.map((s) => ({
        key: s.id,
        label: s.label,
        to: sectionPath(storyId, route.id, s.id),
        icon: s.icon,
        end: s.path === "",
        gap: GAP_BEFORE.has(`${route.id}.${s.id}`),
      }))}
    >
      <Routes>
        {sections.map((s) => {
          const key = `${route.id}.${s.id}`;
          const Body = SECTION_ELEMENTS[key] as Body;
          const rel = s.path.replace(/^\//, "");
          // One route per section, the entry optional (`places/:entryId?`): moving from the list
          // to an entry, or between entries, keeps the section mounted and its state with it.
          const path = s.detailParam ? `${rel ? `${rel}/` : ""}:${s.detailParam}?` : rel || undefined;
          return (
            <Route
              key={key}
              index={!path ? true : undefined}
              path={path}
              element={gate(s, <Body storyId={storyId} section={s.id} />)}
            />
          );
        })}
        <Route path="*" element={<div className={styles.loading}>There is no page here.</div>} />
      </Routes>
    </BrowserShell>
  );
}
