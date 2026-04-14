import { useState, useEffect, useRef } from "react";
import { useTree } from "@headless-tree/react";
import {
  syncDataLoaderFeature,
  selectionFeature,
  type ItemInstance,
} from "@headless-tree/core";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import { api } from "../../api/client";

type ChildrenMap = Record<string, string[]>;
type ItemMap = Record<string, StructureNode>;

export function buildMaps(nodes: StructureNode[]): { childrenMap: ChildrenMap; itemMap: ItemMap } {
  const childrenMap: ChildrenMap = { root: [] };
  const itemMap: ItemMap = {};

  function traverse(node: StructureNode, parentId: string) {
    itemMap[node.id] = node;
    if (!childrenMap[parentId]) childrenMap[parentId] = [];
    childrenMap[parentId].push(node.id);
    childrenMap[node.id] = [];
    (node.children ?? []).forEach((child) => traverse(child, node.id));
  }

  nodes.forEach((node) => traverse(node, "root"));
  return { childrenMap, itemMap };
}

export function applyChildrenMap(childrenMap: ChildrenMap, itemMap: ItemMap): StructureNode[] {
  function buildNode(id: string): StructureNode {
    const node = itemMap[id];
    const childIds = childrenMap[id] ?? [];
    return { ...node, children: childIds.map(buildNode) };
  }
  return (childrenMap["root"] ?? []).map(buildNode);
}

export function computeOps(childrenMap: ChildrenMap) {
  return Object.entries(childrenMap).flatMap(([parentId, children]) =>
    children.map((nodeId, position) => ({
      node_id: nodeId,
      parent_id: parentId === "root" ? null : parentId,
      position,
    }))
  );
}

export function useStructureTree(storyId: string) {
  const { structure, activeNode, setActiveNode } = useStoryStore();

  const [childrenMap, setChildrenMap] = useState<ChildrenMap>(() => buildMaps(structure).childrenMap);
  const [itemMap, setItemMap] = useState<ItemMap>(() => buildMaps(structure).itemMap);

  // Track previous structure to avoid rebuilding on our own optimistic updates
  const prevStructureRef = useRef(structure);

  useEffect(() => {
    if (prevStructureRef.current === structure) return;
    prevStructureRef.current = structure;
    const { childrenMap: cm, itemMap: im } = buildMaps(structure);
    setChildrenMap(cm);
    setItemMap(im);
  }, [structure]);

  const childrenMapRef = useRef(childrenMap);
  childrenMapRef.current = childrenMap;
  const itemMapRef = useRef(itemMap);
  itemMapRef.current = itemMap;

  const tree = useTree<StructureNode>({
    rootItemId: "root",
    getItemName: (item) => item.getItemData()?.title ?? "",
    isItemFolder: (item) => {
      const id = item.getId();
      return id === "root" || (childrenMapRef.current[id] ?? []).length > 0;
    },
    dataLoader: {
      getItem: (id) => {
        if (id === "root") return { id: "root", title: "root" } as StructureNode;
        return itemMapRef.current[id];
      },
      getChildren: (id) => childrenMapRef.current[id] ?? [],
    },
    features: [syncDataLoaderFeature, selectionFeature],
    initialState: {
      expandedItems: ["root", ...Object.keys(itemMap)],
      selectedItems: activeNode ? [activeNode.id] : [],
    },
    onPrimaryAction: (item: ItemInstance<StructureNode>) => {
      const node = itemMapRef.current[item.getId()];
      if (node) api.getNode(node.id).then(setActiveNode);
    },
  });

  return {
    tree,
    childrenMap,
    itemMap,
    childrenMapRef,
    itemMapRef,
    prevStructureRef,
    setChildrenMap,
    storyId,
  };
}
