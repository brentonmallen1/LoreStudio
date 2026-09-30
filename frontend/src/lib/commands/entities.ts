/**
 * Palette commands for the things in a story (refactor doc 11, phase 4): stories, the
 * cast, places, threads and every node of the outline. They follow the store, so they are
 * registered from a hook rather than at module load. A character, place or thread opens
 * beside the page; ⌘Enter (or the row's pill) goes to its full page instead.
 */
import { useEffect } from "react";
import { BookOpen, Clapperboard, GitBranch, MapPin, Users } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { EntityKind } from "../../types/panel";

const GO = { label: "Go to page" };

function entityCommand(
  id: string,
  kind: EntityKind,
  entityId: string,
  name: string,
  storyId: string,
  page: string,
  icon: typeof Users,
  group: string,
) {
  commandRegistry.update({
    id,
    label: name,
    description: "Open beside the page",
    keywords: [kind, "open", "view", name.toLowerCase()],
    icon,
    group,
    when: () => useStoryStore.getState().activeStory?.id === storyId,
    action: () => usePanelStore.getState().openEntity(kind, entityId, name),
    secondaryAction: { ...GO, run: () => navigateTo(page) },
  });
}

/** Keeps the dynamic commands in step with the story store. Mount once, in the palette. */
export function useEntityCommands() {
  const { stories, characters, locations, threads, structure, activeStory } = useStoryStore();

  useEffect(() => {
    for (const s of stories) {
      commandRegistry.update({
        id: `story-${s.id}`,
        label: s.title,
        keywords: ["story", "open", "navigate"],
        icon: BookOpen,
        group: "Stories",
        action: () => navigateTo(`/stories/${s.id}`),
      });
    }
  }, [stories]);

  useEffect(() => {
    const ids = new Set<string>();
    if (activeStory) {
      const base = `/stories/${activeStory.id}`;
      for (const c of characters) {
        const id = `char-view-${c.id}`;
        ids.add(id);
        entityCommand(
          id,
          "character",
          c.id,
          c.name,
          activeStory.id,
          `${base}/lorebook/characters/${c.id}`,
          Users,
          "Characters",
        );
      }
      for (const l of locations) {
        const id = `place-view-${l.id}`;
        ids.add(id);
        entityCommand(
          id,
          "location",
          l.id,
          l.name,
          activeStory.id,
          `${base}/lorebook/places/${l.id}`,
          MapPin,
          "Places",
        );
      }
      for (const t of threads) {
        const id = `thread-view-${t.id}`;
        ids.add(id);
        entityCommand(
          id,
          "thread",
          t.id,
          t.name,
          activeStory.id,
          `${base}/lorebook/threads`,
          GitBranch,
          "Threads",
        );
      }
      const walk = (nodes: typeof structure) => {
        for (const node of nodes) {
          const id = `write-node-${node.id}`;
          ids.add(id);
          commandRegistry.update({
            id,
            label: node.title || `Untitled ${node.level_type}`,
            description: node.synopsis ? node.synopsis.slice(0, 80) : undefined,
            keywords: [
              "write",
              node.level_type,
              "scene",
              "chapter",
              "go to",
              "navigate",
              node.title.toLowerCase(),
            ],
            icon: Clapperboard,
            group: "Write",
            when: () => useStoryStore.getState().activeStory?.id === node.story_id,
            action: () => navigateTo(`${base}/write/${node.id}`),
          });
          walk(node.children ?? []);
        }
      };
      walk(structure);
    }
    return () => ids.forEach((id) => commandRegistry.unregister(id));
  }, [activeStory, characters, locations, threads, structure]);
}
