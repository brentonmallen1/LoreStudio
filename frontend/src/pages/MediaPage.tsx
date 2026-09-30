import { parseServerDate } from "../lib/serverDate";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, GitBranch, ImageIcon, Trash2, Network } from "lucide-react";
import { api } from "../api/client";
import { sectionPath } from "../lib/routes";
import type { StoryAsset, Diagram, DiagramSummary } from "../types";
import MediaLibrary from "../components/media/MediaLibrary";
import DiagramEditor from "../components/media/DiagramEditor";
import styles from "./MediaPage.module.css";

type Tab = "media" | "diagrams";

/** The Compendium's Images and Diagrams sections (doc 12 P1): the tabs became index entries. */
export default function MediaPage({ section = "images" }: { section?: string }) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const tab: Tab = section === "diagrams" ? "diagrams" : "media";
  const setTab = (next: Tab) =>
    storyId && navigate(sectionPath(storyId, "compendium", next === "diagrams" ? "diagrams" : "images"));
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [activeDiagram, setActiveDiagram] = useState<Diagram | null>(null);
  const [loadingDiagrams, setLoadingDiagrams] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"mindmap" | "flowchart">("mindmap");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) return;
    api
      .listAssets(storyId)
      .then(setAssets)
      .catch(() => {});
    loadDiagrams();
  }, [storyId]);

  async function loadDiagrams() {
    if (!storyId) return;
    setLoadingDiagrams(true);
    try {
      const list = await api.listDiagrams(storyId);
      setDiagrams(list);
    } finally {
      setLoadingDiagrams(false);
    }
  }

  async function openDiagram(id: string) {
    const d = await api.getDiagram(id);
    setActiveDiagram(d);
  }

  async function createDiagram() {
    if (!storyId || !newTitle.trim()) return;
    const d = await api.createDiagram(storyId, { title: newTitle.trim(), diagram_type: newType });
    setDiagrams((prev) => [d, ...prev]);
    setNewTitle("");
    setCreating(false);
    const full = await api.getDiagram(d.id);
    setActiveDiagram(full);
    setTab("diagrams");
  }

  async function deleteDiagram(id: string) {
    await api.deleteDiagram(id);
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    if (activeDiagram?.id === id) setActiveDiagram(null);
    setConfirmDelete(null);
  }

  if (activeDiagram) {
    return (
      <div className={styles.page}>
        <div className={styles.diagramFullscreen}>
          <DiagramEditor
            diagram={activeDiagram}
            onSave={(updated) => {
              setActiveDiagram(updated);
              setDiagrams((prev) =>
                prev.map((d) =>
                  d.id === updated.id ? { ...d, title: updated.title, updated_at: updated.updated_at } : d,
                ),
              );
            }}
            onClose={() => setActiveDiagram(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {tab === "media" ? <ImageIcon size={15} /> : <Network size={15} />}
          {tab === "media" ? "Images" : "Diagrams"}
          <span className={styles.tabCount}>{tab === "media" ? assets.length : diagrams.length}</span>
        </h2>
      </div>

      <div className={styles.content}>
        {tab === "media" && storyId && (
          <MediaLibrary storyId={storyId} assets={assets} onAssetsChange={setAssets} />
        )}

        {tab === "diagrams" && (
          <div className={styles.diagramsView}>
            <div className={styles.diagramsToolbar}>
              {creating ? (
                <div className={styles.createForm}>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createDiagram();
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewTitle("");
                      }
                    }}
                    placeholder="Diagram title…"
                    className={styles.createInput}
                  />
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "mindmap" | "flowchart")}
                    className={styles.typeSelect}
                  >
                    <option value="mindmap">Mindmap</option>
                    <option value="flowchart">Flowchart</option>
                  </select>
                  <button onClick={createDiagram} className={styles.createBtn} disabled={!newTitle.trim()}>
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setNewTitle("");
                    }}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className={styles.newDiagramBtn}>
                  <Plus size={13} /> New Diagram
                </button>
              )}
            </div>

            {loadingDiagrams ? (
              <p className={styles.hint}>Loading…</p>
            ) : diagrams.length === 0 ? (
              <div className={styles.emptyDiagrams}>
                <Network size={36} />
                <p>No diagrams yet</p>
                <p className={styles.hintSub}>Create mindmaps and flowcharts to plan your story</p>
              </div>
            ) : (
              <div className={styles.diagramGrid}>
                {diagrams.map((d) => (
                  <div key={d.id} className={styles.diagramCard}>
                    <button className={styles.diagramCardMain} onClick={() => openDiagram(d.id)}>
                      <div className={styles.diagramThumb}>
                        {d.diagram_type === "mindmap" ? <Network size={24} /> : <GitBranch size={24} />}
                      </div>
                      <div className={styles.diagramInfo}>
                        <span className={styles.diagramTitle}>{d.title}</span>
                        {d.description && <span className={styles.diagramDesc}>{d.description}</span>}
                        <span className={styles.diagramMeta}>
                          {d.diagram_type} · {parseServerDate(d.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                    {confirmDelete === d.id ? (
                      <div className={styles.deleteConfirm}>
                        <span>Delete?</span>
                        <button onClick={() => deleteDiagram(d.id)} className={styles.confirmYes}>
                          Yes
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className={styles.confirmNo}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className={styles.diagramDeleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(d.id);
                        }}
                        title="Delete diagram"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
