import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../api/client";
import { findNode } from "../components/layout/structureTreeMeta";
import AutosaveTextarea from "../components/panel/AutosaveTextarea";
import { sceneToResume } from "../lib/resumeScene";
import { stopShape } from "../lib/strip/stripModel";
import { useStoryStore } from "../stores/storyStore";
import type { StructureNode } from "../types";
import styles from "./ContainerNodePage.module.css";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function words(node: StructureNode): number {
  return (node.word_count ?? 0) + (node.children ?? []).reduce((n, c) => n + words(c), 0);
}

function parentOf(
  nodes: StructureNode[],
  id: string,
  parent: StructureNode | null = null,
): StructureNode | null | undefined {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const hit = parentOf(n.children ?? [], id, n);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * An act's or a chapter's own page (refactor doc 11, phase 3): its plan, the same
 * synopsis and purpose a scene has, and the scenes or chapters it holds as cards. A
 * station on the strip opens here; the scenes open from here.
 */
export default function ContainerNodePage({ node }: { node: StructureNode }) {
  const navigate = useNavigate();
  const { activeStory, activeTemplate, structure, setStructure, patchNode } = useStoryStore();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  if (!activeStory) return null;
  const storyId = activeStory.id;
  const levelName = activeTemplate?.levels[node.level]?.name ?? node.level_type;
  const childLevel = activeTemplate?.levels[node.level + 1];
  const childName = childLevel?.name ?? "Scene";
  const childIsLeaf = !activeTemplate || node.level + 1 >= activeTemplate.levels.length - 1;
  const parent = parentOf(structure, node.id) ?? null;
  const siblings = parent ? (parent.children ?? []) : structure;
  const index = siblings.findIndex((s) => s.id === node.id);
  const children = findNode(structure, node.id)?.children ?? node.children ?? [];
  const back = sceneToResume(storyId, structure, null);
  const save = (field: "synopsis" | "purpose") => (value: string) =>
    api
      .updateNode(node.id, { [field]: value })
      .then((saved) => patchNode(node.id, { [field]: saved[field] }));

  async function addChild() {
    const title = newTitle.trim();
    if (!title) return;
    const created = await api.createNode(storyId, {
      title,
      parent_id: node.id,
      level: node.level + 1,
      level_type: childName.toLowerCase(),
      position: children.length,
      status: childIsLeaf ? "planned" : "draft",
    });
    const insert = (nodes: StructureNode[]): StructureNode[] =>
      nodes.map((n) =>
        n.id === node.id
          ? { ...n, children: [...(n.children ?? []), { ...created, children: [] }] }
          : { ...n, children: insert(n.children ?? []) },
      );
    setStructure(insert(structure));
    setNewTitle("");
    setAdding(false);
    if (childIsLeaf) navigate(`/stories/${storyId}/write/${created.id}`);
  }

  return (
    <div className={styles.scroller}>
      <div className={styles.page}>
        {back && back.id !== node.id && (
          <button className={styles.back} onClick={() => navigate(`/stories/${storyId}/write/${back.id}`)}>
            <ArrowLeft size={13} /> Back to {back.title}
          </button>
        )}
        <div className={styles.kicker}>
          {parent ? `${parent.title} · ` : ""}
          {levelName} {index + 1} of {siblings.length}
        </div>
        <h1 className={styles.title}>{node.title}</h1>

        <section className={styles.plan}>
          <div className={styles.planHead}>The plan for this {levelName.toLowerCase()}</div>
          <AutosaveTextarea
            key={`${node.id}:synopsis`}
            label="Synopsis"
            initial={node.synopsis ?? ""}
            placeholder={`What happens across this ${levelName.toLowerCase()}…`}
            rows={2}
            save={save("synopsis")}
          />
          <AutosaveTextarea
            key={`${node.id}:purpose`}
            label="Why it's here"
            initial={node.purpose ?? ""}
            placeholder="What it does for the story that nothing else does…"
            rows={3}
            save={save("purpose")}
          />
        </section>

        <div className={styles.sectionHead}>
          Its {childLevel?.plural?.toLowerCase() ?? `${childName.toLowerCase()}s`}
        </div>
        <div className={styles.grid}>
          {children.map((child) => {
            const planned = child.status === "planned";
            const shape = stopShape(child.status);
            return (
              <button
                key={child.id}
                className={`${styles.card} ${planned ? styles.cardPlanned : ""}`}
                onClick={() => navigate(`/stories/${storyId}/write/${child.id}`)}
              >
                <span className={styles.cardHead}>
                  <span className={`${styles.state} ${styles[`state_${shape}`]}`} />
                  <span className={styles.cardTitle}>{child.title}</span>
                  <span className={styles.cardMeta}>
                    {child.children?.length
                      ? `${child.children.length} ${child.children.length === 1 ? "scene" : "scenes"} · ${fmt(words(child))}`
                      : planned
                        ? "planned"
                        : `${fmt(child.word_count ?? 0)} words · ${child.status}`}
                  </span>
                </span>
                {child.synopsis && <span className={styles.cardText}>{child.synopsis}</span>}
              </button>
            );
          })}
          {adding ? (
            <div className={`${styles.card} ${styles.cardAdd}`}>
              <input
                autoFocus
                className={styles.addInput}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addChild();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder={`${childName} title…`}
              />
              <div className={styles.addActions}>
                <button className={styles.primary} onClick={addChild}>
                  Add
                </button>
                <button className={styles.secondary} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className={`${styles.card} ${styles.cardAdd}`} onClick={() => setAdding(true)}>
              <Plus size={14} /> Add a {childName.toLowerCase()} here
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
