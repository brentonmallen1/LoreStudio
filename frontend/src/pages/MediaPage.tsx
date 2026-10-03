import { parseServerDate } from "../lib/serverDate";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, GitBranch, Trash2, Network } from "lucide-react";
import { api } from "../api/client";
import { sectionPath } from "../lib/routes";
import type { StoryAsset, Diagram, DiagramSummary } from "../types";
import MediaLibrary from "../components/media/MediaLibrary";
import DiagramEditor from "../components/media/DiagramEditor";
import ImageSheet from "../components/media/ImageSheet";
import PageHeader from "../components/layout/PageHeader";
import styles from "./MediaPage.module.css";

type Tab = "media" | "diagrams";

/** The Compendium's Images and Diagrams sections (doc 12 P1): the tabs became index entries. */
export default function MediaPage({ section = "images" }: { section?: string }) {
  const { storyId, entryId } = useParams<{ storyId: string; entryId?: string }>();
  const navigate = useNavigate();
  const tab: Tab = section === "diagrams" ? "diagrams" : "media";
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loadedDiagram, setLoadedDiagram] = useState<Diagram | null>(null);
  const activeDiagram = tab === "diagrams" && entryId && loadedDiagram?.id === entryId ? loadedDiagram : null;
  const setActiveDiagram = setLoadedDiagram;
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

  // An image or a diagram has its own address (doc 13 P5): the index and links open it.
  function openDiagram(id: string) {
    if (storyId) navigate(sectionPath(storyId, "compendium", "diagrams", id));
  }
  const closeDiagram = () => storyId && navigate(sectionPath(storyId, "compendium", "diagrams"));
  useEffect(() => {
    if (tab === "diagrams" && entryId) api.getDiagram(entryId).then(setLoadedDiagram, () => closeDiagram());
  }, [tab, entryId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createDiagram() {
    if (!storyId || !newTitle.trim()) return;
    const d = await api.createDiagram(storyId, { title: newTitle.trim(), diagram_type: newType });
    setDiagrams((prev) => [d, ...prev]);
    setNewTitle("");
    setCreating(false);
    openDiagram(d.id);
  }

  async function deleteDiagram(id: string) {
    await api.deleteDiagram(id);
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    if (activeDiagram?.id === id) closeDiagram();
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
            onClose={closeDiagram}
          />
        </div>
      </div>
    );
  }

  const asset = tab === "media" && entryId ? assets.find((a) => a.id === entryId) : undefined;
  if (asset && storyId) {
    return (
      <ImageSheet
        storyId={storyId}
        asset={asset}
        onChange={(next) => {
          setAssets((prev) =>
            next ? prev.map((a) => (a.id === next.id ? next : a)) : prev.filter((a) => a.id !== asset.id),
          );
          // A deleted image's address has nothing left to show: back to the list.
          if (!next) navigate(sectionPath(storyId, "compendium", "images"), { replace: true });
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={tab === "media" ? "Images" : "Diagrams"}
        summary={
          tab === "media"
            ? `${assets.length} ${assets.length === 1 ? "file" : "files"} · pictures and documents the story uses`
            : `${diagrams.length} ${diagrams.length === 1 ? "diagram" : "diagrams"} · mindmaps and flowcharts`
        }
        primary={
          tab === "diagrams"
            ? { label: "New diagram", icon: Plus, onClick: () => setCreating(true) }
            : undefined
        }
      />

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
              ) : null}
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
                        aria-label="Delete diagram"
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
