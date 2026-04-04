import React, { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import SceneCard from "./SceneCard";
import styles from "./CorkboardView.module.css";

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    result.push(n);
    if (n.children) n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}


export default function CorkboardView() {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure, setActiveNode } = useStoryStore();
  const dragNodeId = useRef<string | null>(null);
  const dragOverNodeId = useRef<string | null>(null);

  const allNodes = flattenNodes(structure);

  // Group all nodes by parent for display
  const topLevelNodes = structure; // show top-level grouping

  function renderGroup(group: StructureNode, depth: number = 0): React.ReactElement {
    const directChildren = (group.children ?? []).filter((c) => !c.children || c.children.length === 0);
    const subGroups = (group.children ?? []).filter((c) => c.children && c.children.length > 0);

    return (
      <div key={group.id} className={styles.group} style={{ marginLeft: depth * 12 }}>
        <h3 className={styles.groupTitle}>{group.title}</h3>
        {subGroups.map((sg) => renderGroup(sg, depth + 1))}
        {directChildren.length > 0 && (
          <div className={styles.cardsRow}>
            {directChildren.map((node) => (
              <SceneCard
                key={node.id}
                node={node}
                onClick={() => {
                  setActiveNode(node);
                  navigate(`/stories/${storyId}`);
                }}
                onDragStart={() => { dragNodeId.current = node.id; }}
                onDragOver={() => { dragOverNodeId.current = node.id; }}
                onDrop={async () => {
                  if (!dragNodeId.current || dragNodeId.current === dragOverNodeId.current) return;
                  const siblings = [...directChildren];
                  const fromIdx = siblings.findIndex((n) => n.id === dragNodeId.current);
                  const toIdx = siblings.findIndex((n) => n.id === dragOverNodeId.current);
                  if (fromIdx === -1 || toIdx === -1) return;

                  // Reorder locally
                  const [moved] = siblings.splice(fromIdx, 1);
                  siblings.splice(toIdx, 0, moved);

                  // Update positions via API
                  for (let i = 0; i < siblings.length; i++) {
                    if (siblings[i].position !== i) {
                      await api.updateNode(siblings[i].id, { position: i });
                    }
                  }

                  // Refresh structure from server
                  const updated = await api.getStructure(storyId!);
                  setStructure(updated);
                  dragNodeId.current = null;
                  dragOverNodeId.current = null;
                }}
                isDraggingOver={false}
              />
            ))}
          </div>
        )}
        {/* Also show this node itself if it has no children (leaf node at group level) */}
        {!group.children?.length && (
          <div className={styles.cardsRow}>
            <SceneCard
              key={group.id}
              node={group}
              onClick={() => {
                setActiveNode(group);
                navigate(`/stories/${storyId}`);
              }}
              onDragStart={() => { dragNodeId.current = group.id; }}
              onDragOver={() => { dragOverNodeId.current = group.id; }}
              onDrop={() => {}}
              isDraggingOver={false}
            />
          </div>
        )}
      </div>
    );
  }

  if (allNodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No scenes yet. Add sections in the tree view to get started.</p>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.boardInner}>
        {topLevelNodes.map((node) => (
          node.children?.length ? renderGroup(node) :
          <div key={node.id} className={styles.group}>
            <div className={styles.cardsRow}>
              <SceneCard
                node={node}
                onClick={() => {
                  setActiveNode(node);
                  navigate(`/stories/${storyId}`);
                }}
                onDragStart={() => { dragNodeId.current = node.id; }}
                onDragOver={() => { dragOverNodeId.current = node.id; }}
                onDrop={() => {}}
                isDraggingOver={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
