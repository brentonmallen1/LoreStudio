import { create } from "zustand";
import type { Story, StructureNode, Character, StoryStructureTemplate, BeatSheet } from "../types";

interface StoryState {
  stories: Story[];
  setStories: (stories: Story[]) => void;
  upsertStory: (story: Story) => void;
  removeStory: (id: string) => void;

  activeStory: Story | null;
  setActiveStory: (story: Story | null) => void;

  activeTemplate: StoryStructureTemplate | null;
  setActiveTemplate: (template: StoryStructureTemplate | null) => void;

  structure: StructureNode[];
  setStructure: (nodes: StructureNode[]) => void;
  /** Merge saved fields into one node of the tree (and the open node, if it is that one). */
  patchNode: (id: string, patch: Partial<StructureNode>) => void;

  activeNode: StructureNode | null;
  setActiveNode: (node: StructureNode | null) => void;

  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  upsertCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;

  beatSheets: BeatSheet[];
  setBeatSheets: (sheets: BeatSheet[]) => void;
}

function patchTree(nodes: StructureNode[], id: string, patch: Partial<StructureNode>): StructureNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, ...patch, children: n.children }
      : { ...n, children: patchTree(n.children ?? [], id, patch) },
  );
}

export const useStoryStore = create<StoryState>((set) => ({
  stories: [],
  setStories: (stories) => set({ stories }),
  upsertStory: (story) =>
    set((s) => ({
      stories: s.stories.some((x) => x.id === story.id)
        ? s.stories.map((x) => (x.id === story.id ? story : x))
        : [story, ...s.stories],
    })),
  removeStory: (id) => set((s) => ({ stories: s.stories.filter((x) => x.id !== id) })),

  activeStory: null,
  setActiveStory: (story) => set({ activeStory: story }),

  activeTemplate: null,
  setActiveTemplate: (template) => set({ activeTemplate: template }),

  structure: [],
  setStructure: (nodes) => set({ structure: nodes }),
  patchNode: (id, patch) =>
    set((s) => ({
      structure: patchTree(s.structure, id, patch),
      activeNode: s.activeNode?.id === id ? { ...s.activeNode, ...patch } : s.activeNode,
    })),

  activeNode: null,
  setActiveNode: (node) => set({ activeNode: node }),

  characters: [],
  setCharacters: (characters) => set({ characters }),
  upsertCharacter: (character) =>
    set((s) => ({
      characters: s.characters.some((x) => x.id === character.id)
        ? s.characters.map((x) => (x.id === character.id ? character : x))
        : [...s.characters, character],
    })),
  removeCharacter: (id) => set((s) => ({ characters: s.characters.filter((x) => x.id !== id) })),

  beatSheets: [],
  setBeatSheets: (sheets) => set({ beatSheets: sheets }),
}));
