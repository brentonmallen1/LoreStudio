import { api } from "../../api/client";
import { structureApi } from "../../api/structure";
import { parentForLevel } from "../../components/layout/structureTreeMeta";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import { sceneLeaves } from "./methods";

function insertChild(nodes: StructureNode[], parentId: string, child: StructureNode): StructureNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: [...(n.children ?? []), child] }
      : { ...n, children: insertChild(n.children ?? [], parentId, child) },
  );
}

/**
 * Add a planned scene at the end of the story: a real scene in the structure tree, with a
 * line saying what happens and no prose yet. Goes beside the last scene; an empty story
 * first gets its template's outline, whose first scene becomes this one. Returns a hint
 * instead when there is nowhere to put it (every chapter deleted, say).
 */
export async function addPlannedScene(
  storyId: string,
  fields: { title?: string; synopsis?: string } = {},
): Promise<{ node: StructureNode } | { hint: string }> {
  const { structure, activeTemplate, setStructure } = useStoryStore.getState();
  const deepest = activeTemplate && !activeTemplate.flat ? activeTemplate.levels.length - 1 : 0;
  const levelName = activeTemplate?.levels[deepest]?.name ?? "Scene";
  const scenes = sceneLeaves(structure, activeTemplate);
  const title = fields.title?.trim() || `${levelName} ${scenes.length + 1}`;

  if (structure.length === 0) {
    const { start_node_id } = await structureApi.start(storyId);
    const node = await api.updateNode(start_node_id, {
      status: "planned",
      title,
      synopsis: fields.synopsis ?? "",
    });
    setStructure(await api.getStructure(storyId));
    return { node };
  }

  const parent = deepest === 0 ? null : parentForLevel(structure, deepest, scenes.at(-1) ?? null);
  if (deepest > 0 && !parent) {
    const above = activeTemplate?.levels[deepest - 1]?.name.toLowerCase() ?? "section";
    return { hint: `Add a ${above} in the structure tree first; scenes go inside one.` };
  }
  const siblings = parent ? (parent.children ?? []) : structure;
  const node = await api.createNode(storyId, {
    title,
    synopsis: fields.synopsis ?? "",
    parent_id: parent?.id ?? null,
    level: deepest,
    level_type: levelName.toLowerCase(),
    position: siblings.length,
    status: "planned",
  });
  const created = { ...node, children: [] };
  setStructure(parent ? insertChild(structure, parent.id, created) : [...structure, created]);
  return { node };
}
