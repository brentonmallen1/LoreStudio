import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Edit2, MessageSquare, ChevronRight, Plus, Trash2, Check, Eye, EyeOff, Compass, User, MapPin, ExternalLink } from "lucide-react";
import { SectionCard } from "../common";
import CharacterDialogueTab from "./CharacterDialogueTab";
import ArcTimelineView from "./ArcTimelineView";
import ArcAnalysisPanel from "./ArcAnalysisPanel";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";
import type { CharacterAttributes, StructureNode } from "../../types";

const ATTRIBUTE_DEFS: { key: keyof CharacterAttributes; label: string; options: string[] }[] = [
  { key: "intelligence",    label: "Intelligence",    options: ["Brilliant", "Sharp", "Average", "Simple", "Slow"] },
  { key: "education",       label: "Education",       options: ["Scholarly", "Educated", "Common", "Unlettered"] },
  { key: "moral_alignment", label: "Moral Alignment", options: ["Righteous", "Principled", "Pragmatic", "Self-Serving", "Corrupt"] },
  { key: "disposition",     label: "Disposition",     options: ["Orderly", "Conventional", "Flexible", "Unpredictable", "Chaotic"] },
  { key: "temperament",     label: "Temperament",     options: ["Serene", "Calm", "Balanced", "Volatile", "Explosive"] },
  { key: "social_manner",   label: "Social Manner",   options: ["Refined", "Polished", "Casual", "Rough", "Crude"] },
];
import CharacterFormDialog from "./CharacterFormDialog";
import AttributeGeneratorPanel from "./AttributeGeneratorPanel";
import StartInterviewDialog from "./StartInterviewDialog";
import AssetPicker from "../media/AssetPicker";
import PortraitEditor, { type CharacterImageDescription } from "../media/PortraitEditor";
import styles from "./CharacterSheet.module.css";


export default function CharacterSheet() {
  const { characterId, storyId } = useParams<{ characterId: string; storyId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { characters, upsertCharacter, structure, setActiveNode } = useStoryStore();
  const { resumeSession } = useAIStore();
  const [editing, setEditing] = useState(false);
  const [portraitDesc, setPortraitDesc] = useState<CharacterImageDescription | null>(null);
  const [showStartInterview, setShowStartInterview] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [missionText, setMissionText] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  function toggle(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  const intentSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSaveRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localFields, setLocalFields] = useState<Record<string, string>>({});
  const [newPrompt, setNewPrompt] = useState("");
  const [newTraitKey, setNewTraitKey] = useState("");
  const [newTraitValue, setNewTraitValue] = useState("");

  const initialTab = searchParams.get("tab") === "arc" ? "arc" : "overview";
  const [activeTab, setActiveTab] = useState<"overview" | "dialogue" | "arc">(initialTab);
  const [sceneNodes, setSceneNodes] = useState<StructureNode[]>([]);
  const character = characters.find((c) => c.id === characterId);

  useEffect(() => {
    if (!characterId || character) return;
    api.getCharacter(characterId).then(upsertCharacter).catch(console.error);
  }, [characterId]);

  // Load leaf scenes for milestone scene-picker
  useEffect(() => {
    if (!storyId) return;
    api.getStructure(storyId).then((tree) => {
      const leaves: StructureNode[] = [];
      function walk(nodes: StructureNode[]) {
        for (const n of nodes) {
          if (!n.children?.length) leaves.push(n);
          else walk(n.children);
        }
      }
      walk(tree);
      setSceneNodes(leaves);
    }).catch(() => {});
  }, [storyId]);

  useEffect(() => {
    if (character) {
      setIntentText(character.narrative_intent ?? "");
      setMissionText(character.mission_statement ?? "");
      setLocalFields({
        personality: character.personality ?? "",
        motivation: character.motivation ?? "",
        background: character.background ?? "",
        appearance: character.appearance ?? "",
        arc_notes: character.arc_notes ?? "",
        snowflake_summary: character.snowflake_summary ?? "",
        snowflake_synopsis: character.snowflake_synopsis ?? "",
      });
    }
  }, [character?.id]);

  function scheduleIntentSave(text: string) {
    if (intentSaveRef.current) clearTimeout(intentSaveRef.current);
    intentSaveRef.current = setTimeout(async () => {
      if (!character) return;
      const updated = await api.updateCharacter(character.id, { narrative_intent: text });
      upsertCharacter(updated);
    }, 900);
  }

  function scheduleMissionSave(text: string) {
    if (missionSaveRef.current) clearTimeout(missionSaveRef.current);
    missionSaveRef.current = setTimeout(async () => {
      if (!character) return;
      const updated = await api.updateCharacter(character.id, { mission_statement: text });
      upsertCharacter(updated);
    }, 900);
  }

  function scheduleFieldSave(field: string, value: string) {
    setLocalFields((prev) => ({ ...prev, [field]: value }));
    if (fieldSaveRefs.current[field]) clearTimeout(fieldSaveRefs.current[field]);
    fieldSaveRefs.current[field] = setTimeout(async () => {
      if (!character) return;
      const updated = await api.updateCharacter(character.id, { [field]: value });
      upsertCharacter(updated);
    }, 800);
  }

  async function addInterviewPrompt() {
    if (!newPrompt.trim() || !character) return;
    const updated = await api.updateCharacter(character.id, {
      interview_prompts: [...(character.interview_prompts ?? []), newPrompt.trim()],
    });
    upsertCharacter(updated);
    setNewPrompt("");
  }

  async function removeInterviewPrompt(index: number) {
    if (!character) return;
    const prompts = (character.interview_prompts ?? []).filter((_, i) => i !== index);
    const updated = await api.updateCharacter(character.id, { interview_prompts: prompts });
    upsertCharacter(updated);
  }

  async function addTrait() {
    if (!newTraitKey.trim() || !character) return;
    const traits = { ...(character.traits ?? {}), [newTraitKey.trim()]: newTraitValue.trim() };
    const updated = await api.updateCharacter(character.id, { traits });
    upsertCharacter(updated);
    setNewTraitKey("");
    setNewTraitValue("");
  }

  async function removeTrait(key: string) {
    if (!character) return;
    const traits = { ...(character.traits ?? {}) };
    delete traits[key];
    const updated = await api.updateCharacter(character.id, { traits });
    upsertCharacter(updated);
  }

  async function toggleIntentHidden() {
    if (!character) return;
    const updated = await api.updateCharacter(character.id, { narrative_intent_hidden: !character.narrative_intent_hidden });
    upsertCharacter(updated);
  }

  async function addMilestone() {
    const text = newMilestone.trim();
    if (!text || !character) return;
    const updated = await api.addMilestone(character.id, text);
    upsertCharacter(updated);
    setNewMilestone("");
  }

  async function toggleMilestone(milestoneId: string, completed: boolean) {
    if (!character) return;
    const m = character.arc_milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    const updated = await api.updateMilestone(character.id, milestoneId, { text: m.text, completed: !completed });
    upsertCharacter(updated);
  }

  async function removeMilestone(milestoneId: string) {
    if (!character) return;
    const updated = await api.deleteMilestone(character.id, milestoneId);
    upsertCharacter(updated);
  }

  async function addDiscoveryNote() {
    const text = newNote.trim();
    if (!text || !character) return;
    const updated = await api.addDiscoveryNote(character.id, { text });
    upsertCharacter(updated);
    setNewNote("");
  }

  async function confirmDiscoveryNote(noteId: string) {
    if (!character) return;
    const updated = await api.updateDiscoveryNote(character.id, noteId, { confirmed: true });
    upsertCharacter(updated);
  }

  async function deleteDiscoveryNote(noteId: string) {
    if (!character) return;
    const updated = await api.deleteDiscoveryNote(character.id, noteId);
    upsertCharacter(updated);
  }

  async function linkMilestoneToScene(milestoneId: string, sceneId: string, sceneTitle: string) {
    if (!character) return;
    const m = character.arc_milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    const updated = await api.updateMilestone(character.id, milestoneId, {
      text: m.text,
      completed: m.completed,
      scene_id: sceneId || null,
      scene_title: sceneId ? sceneTitle : null,
    });
    upsertCharacter(updated);
  }

  async function updateAttribute(key: keyof CharacterAttributes, value: string) {
    if (!character) return;
    const updated = await api.updateCharacter(character.id, {
      attributes: { ...character.attributes, [key]: value },
    });
    upsertCharacter(updated);
  }

  async function handleInterviewStarted(interview: import("../../types").Interview) {
    if (!character) return;
    setShowStartInterview(false);
    await resumeSession(
      "interview",
      { characterId: character.id, storyId: storyId ?? character.story_id, nodeId: interview.context_node_id ?? undefined },
      interview.id,
      (interview.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      interview.interview_notes ?? undefined,
    );
  }

  function navigateToMilestoneScene(sceneId: string) {
    if (!storyId) return;
    const queue = [...structure];
    let node = null;
    while (queue.length) {
      const n = queue.shift()!;
      if (n.id === sceneId) { node = n; break; }
      if (n.children) queue.push(...n.children);
    }
    if (node) setActiveNode(node);
    navigate(`/stories/${storyId}/write`);
  }

  if (!character) {
    return (
      <div className={styles.loading}>Loading…</div>
    );
  }

  function roleBadgeClass() {
    if (character!.role === "protagonist") return `${styles.roleBadge} ${styles.protagonist}`;
    if (character!.role === "antagonist") return `${styles.roleBadge} ${styles.antagonist}`;
    return styles.roleBadge;
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.idCard}>
            {storyId && (
              <PortraitEditor
                storyId={storyId}
                objectType="character"
                objectId={character.id}
                placeholder={<User size={32} />}
                onAnalyzeForCharacter={(desc) => setPortraitDesc(desc)}
              />
            )}
            <div className={styles.cardInfo}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{character.name}</h1>
                <span className={roleBadgeClass()}>{character.role}</span>
                {character.pronouns && (
                  <span className={styles.pronounsBadge}>{character.pronouns}</span>
                )}
              </div>
              {character.mission_statement && (
                <p className={styles.missionTeaser}>
                  "{character.mission_statement.length > 90
                    ? character.mission_statement.slice(0, 90) + "…"
                    : character.mission_statement}"
                </p>
              )}
            </div>
            <div className={styles.actions}>
              <button
                onClick={() => setShowStartInterview(true)}
                className={styles.interviewBtn}
              >
                <MessageSquare size={14} />
                Interview
              </button>
              <button
                onClick={() => setShowAiGenerator((s) => !s)}
                className={styles.editBtn}
                title="AI suggestions"
              >
                <Compass size={14} />
              </button>
              <button
                onClick={() => setEditing(true)}
                className={styles.editBtn}
                title="Edit character"
              >
                <Edit2 size={14} />
              </button>
            </div>
          </div>

          {/* AI: Portrait description result */}
          {portraitDesc && (
            <div className={styles.portraitDescPanel}>
              <div className={styles.portraitDescHeader}>
                <span className={styles.portraitDescTitle}>Portrait Description</span>
                <span className={styles.portraitDescAiBadge}>AI</span>
                <button className={styles.portraitDescClose} onClick={() => setPortraitDesc(null)}>✕</button>
              </div>
              <div className={styles.portraitDescBody}>
                {[
                  { label: "Appearance",     value: portraitDesc.appearance },
                  { label: "Personality",    value: portraitDesc.personality },
                  { label: "Voice",          value: portraitDesc.voice },
                  { label: "Age",            value: portraitDesc.age_estimate },
                  { label: "Backstory Hints",value: portraitDesc.backstory_hints },
                ].map(({ label, value }) => (
                  <div key={label} className={styles.portraitDescField}>
                    <span className={styles.portraitDescLabel}>{label}</span>
                    <span className={styles.portraitDescValue}>{value}</span>
                  </div>
                ))}
              </div>
              <p className={styles.portraitDescHint}>These are AI suggestions — copy what's useful into the character form.</p>
            </div>
          )}

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <User size={12} />
              Overview
            </button>
            <button
              className={`${styles.tab} ${activeTab === "dialogue" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("dialogue")}
            >
              <MessageSquare size={12} />
              Dialogue
            </button>
            <button
              className={`${styles.tab} ${activeTab === "arc" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("arc")}
            >
              <MapPin size={12} />
              Arc Journey
            </button>
          </div>
        </div>

        {activeTab === "dialogue" && (
          <CharacterDialogueTab characterId={character.id} characterName={character.name} />
        )}

        {activeTab === "arc" && (
          <div className={styles.arcTab}>
            <ArcTimelineView characterId={character.id} characterName={character.name} />
            <ArcAnalysisPanel characterId={character.id} />
          </div>
        )}

        {activeTab === "overview" && (
          <div className={styles.overview}>

            {/* ── Profile ── */}
            <SectionCard title="Profile" collapsed={!!collapsed.profile} onToggle={() => toggle("profile")}>
              <div className={styles.field}>
                <p className={styles.missionLabel}>Mission Statement</p>
                <p className={styles.missionHint}>One sentence: what does this character fundamentally want or need?</p>
                <textarea
                  value={missionText}
                  onChange={(e) => { setMissionText(e.target.value); scheduleMissionSave(e.target.value); }}
                  placeholder="e.g. To prove they deserve their father's respect, no matter the cost."
                  className={styles.missionTextarea}
                  rows={2}
                />
              </div>
              {(["personality", "motivation", "background", "appearance", "arc_notes"] as const).map((field) => (
                <div key={field} className={styles.field}>
                  <p className={styles.fieldLabel}>{field === "arc_notes" ? "Arc Notes" : field.charAt(0).toUpperCase() + field.slice(1)}</p>
                  <textarea
                    className={styles.fieldTextarea}
                    value={localFields[field] ?? ""}
                    onChange={(e) => scheduleFieldSave(field, e.target.value)}
                    placeholder={`${field === "arc_notes" ? "Arc notes" : field.charAt(0).toUpperCase() + field.slice(1)}…`}
                    rows={3}
                  />
                </div>
              ))}
            </SectionCard>

            {/* ── Narrative Intent ── */}
            <SectionCard title="Narrative Intent" collapsed={!!collapsed.intent} onToggle={() => toggle("intent")} variant="intent">
              <div className={styles.intentHeader}>
                <p className={styles.intentHint}>What is this character FOR in your story? (Arc trajectory, key moments, thematic role.)</p>
                <button
                  className={styles.intentToggle}
                  onClick={toggleIntentHidden}
                  title={character.narrative_intent_hidden ? "Hidden from AI interviews" : "Visible in AI writing assistance"}
                >
                  {character.narrative_intent_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{character.narrative_intent_hidden ? "Hidden from interviews" : "Shown in writing assistance"}</span>
                </button>
              </div>
              <textarea
                value={intentText}
                onChange={(e) => {
                  setIntentText(e.target.value);
                  scheduleIntentSave(e.target.value);
                }}
                placeholder="Will start loyal, lose faith in Act 2, and ultimately betray the protagonist to save someone they love…"
                className={styles.intentTextarea}
                rows={3}
              />
            </SectionCard>

            {/* ── Snowflake Method ── */}
            <SectionCard title="Snowflake Method" collapsed={!!collapsed.snowflake} onToggle={() => toggle("snowflake")}>
              <div className={styles.field}>
                <p className={styles.fieldLabel}>Character Summary</p>
                <p className={styles.intentHint}>One sentence: goal, motivation, conflict, and epiphany.</p>
                <textarea
                  className={styles.fieldTextarea}
                  value={localFields.snowflake_summary ?? ""}
                  onChange={(e) => scheduleFieldSave("snowflake_summary", e.target.value)}
                  placeholder="e.g. Eleanor wants to restore the lighthouse but must confront her guilt over her brother's disappearance…"
                  rows={2}
                />
              </div>
              <div className={styles.field}>
                <p className={styles.fieldLabel}>Character Synopsis</p>
                <p className={styles.intentHint}>A full paragraph told in first person — the character's inner arc in their own voice.</p>
                <textarea
                  className={styles.fieldTextarea}
                  value={localFields.snowflake_synopsis ?? ""}
                  onChange={(e) => scheduleFieldSave("snowflake_synopsis", e.target.value)}
                  placeholder="I grew up believing the light was enough…"
                  rows={5}
                />
              </div>
            </SectionCard>

            {/* ── Arc Milestones ── */}
            <SectionCard title="Arc Milestones" collapsed={!!collapsed.milestones} onToggle={() => toggle("milestones")}>
              <p className={styles.intentHint}>Checkable waypoints for this character's journey. Track progress as you write.</p>
              <div className={styles.milestoneList}>
                {(character.arc_milestones ?? []).map((m) => (
                  <div key={m.id} className={`${styles.milestoneItem} ${m.completed ? styles.milestoneDone : ""}`}>
                    <button
                      className={styles.milestoneCheck}
                      onClick={() => toggleMilestone(m.id, m.completed)}
                      aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                    >
                      {m.completed ? <Check size={10} /> : null}
                    </button>
                    <span className={styles.milestoneText}>{m.text}</span>
                    {m.scene_id && (
                      <button
                        className={styles.milestoneNavBtn}
                        onClick={() => navigateToMilestoneScene(m.scene_id!)}
                        title={`Go to: ${m.scene_title ?? "linked scene"}`}
                      >
                        <ExternalLink size={10} />
                      </button>
                    )}
                    {sceneNodes.length > 0 && (
                      <select
                        className={styles.milestoneScenePicker}
                        value={m.scene_id ?? ""}
                        onChange={(e) => {
                          const node = sceneNodes.find((n) => n.id === e.target.value);
                          linkMilestoneToScene(m.id, e.target.value, node?.title ?? "");
                        }}
                        title="Link to scene"
                      >
                        <option value="">— scene —</option>
                        {sceneNodes.map((n) => (
                          <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>
                        ))}
                      </select>
                    )}
                    <button
                      className={styles.milestoneDelete}
                      onClick={() => removeMilestone(m.id)}
                      aria-label="Remove milestone"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.milestoneAdd}>
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                  placeholder="Add a milestone…"
                  className={styles.milestoneInput}
                />
                <button onClick={addMilestone} className={styles.milestoneAddBtn} disabled={!newMilestone.trim()}>
                  <Plus size={13} />
                </button>
              </div>
            </SectionCard>

            {/* ── Discovery Notes ── */}
            <SectionCard title="Discovery Notes" collapsed={!!collapsed.notes} onToggle={() => toggle("notes")}>
              <p className={styles.intentHint}>Capture unconfirmed observations as you write. Confirm them to make them permanent.</p>
              <div className={styles.discoveryList}>
                {(character.discovery_notes ?? []).map((note) => (
                  <div key={note.id} className={`${styles.discoveryNote} ${note.confirmed ? styles.discoveryConfirmed : styles.discoveryPending}`}>
                    <p className={styles.discoveryText}>{note.text}</p>
                    {note.scene_title && (
                      <span className={styles.discoverySource}>from: {note.scene_title}</span>
                    )}
                    <div className={styles.discoveryActions}>
                      {!note.confirmed && (
                        <button className={styles.confirmBtn} onClick={() => confirmDiscoveryNote(note.id)}>
                          <Check size={10} /> Confirm
                        </button>
                      )}
                      {note.confirmed && (
                        <span className={styles.confirmedBadge}><Check size={10} /> Confirmed</span>
                      )}
                      <button className={styles.milestoneDelete} onClick={() => deleteDiscoveryNote(note.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.milestoneAdd}>
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDiscoveryNote()}
                  placeholder="Add an observation…"
                  className={styles.milestoneInput}
                />
                <button onClick={addDiscoveryNote} className={styles.milestoneAddBtn} disabled={!newNote.trim()}>
                  <Plus size={13} />
                </button>
              </div>
            </SectionCard>

            {/* ── Character Attributes ── */}
            <SectionCard title="Character Attributes" collapsed={!!collapsed.attributes} onToggle={() => toggle("attributes")} variant="ai">
              <p className={styles.attributesHint}>
                Shapes vocabulary, tone, and behaviour during interviews. Leave as Unknown to discover through writing.
              </p>
              <div className={styles.attributesGrid}>
                {ATTRIBUTE_DEFS.map(({ key, label, options }) => {
                  const value = character.attributes?.[key] ?? "unknown";
                  const isUnknown = !value || value === "unknown";
                  return (
                    <div key={key} className={styles.attributeRow}>
                      <span className={styles.attributeLabel}>{label}</span>
                      <select
                        className={styles.attributeSelect}
                        value={isUnknown ? "unknown" : value}
                        data-unknown={isUnknown ? "true" : "false"}
                        onChange={(e) => updateAttribute(key, e.target.value)}
                      >
                        <option value="unknown">Unknown</option>
                        {options.map((o) => (
                          <option key={o} value={o.toLowerCase().replace(" ", "_")}>{o}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* ── Interview Prompts ── */}
            <SectionCard title="Interview Prompts" collapsed={!!collapsed.prompts} onToggle={() => toggle("prompts")} variant="ai">
              <p className={styles.intentHint}>Starting questions for character interviews. Click a prompt to begin.</p>
              <div className={styles.promptList}>
                {(character.interview_prompts ?? []).map((prompt, i) => (
                  <div key={i} className={styles.promptRow}>
                    <button
                      onClick={() => setShowStartInterview(true)}
                      className={styles.promptCard}
                    >
                      <span>{prompt}</span>
                      <ChevronRight size={13} className={styles.promptArrow} />
                    </button>
                    <button
                      className={styles.promptDeleteBtn}
                      onClick={() => removeInterviewPrompt(i)}
                      title="Remove prompt"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.milestoneAdd}>
                <input
                  className={styles.milestoneInput}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInterviewPrompt()}
                  placeholder="Add a prompt…"
                />
                <button className={styles.milestoneAddBtn} onClick={addInterviewPrompt} disabled={!newPrompt.trim()}>
                  <Plus size={13} />
                </button>
              </div>
            </SectionCard>

            {/* ── Traits ── */}
            <SectionCard title="Traits" collapsed={!!collapsed.traits} onToggle={() => toggle("traits")}>
              <p className={styles.intentHint}>Freeform key-value traits — any attributes that don't fit standard fields.</p>
              {Object.keys(character.traits ?? {}).length > 0 && (
                <div className={styles.traitsList}>
                  {Object.entries(character.traits ?? {}).map(([key, value]) => (
                    <div key={key} className={styles.traitRow}>
                      <span className={styles.traitKey}>{key}</span>
                      <span className={styles.traitSep}>·</span>
                      <span className={styles.traitVal}>{String(value)}</span>
                      <button
                        className={styles.traitDelete}
                        onClick={() => removeTrait(key)}
                        title="Remove trait"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.traitAdd}>
                <input
                  className={styles.traitInput}
                  value={newTraitKey}
                  onChange={(e) => setNewTraitKey(e.target.value)}
                  placeholder="Key (e.g. fear)"
                />
                <input
                  className={styles.traitInput}
                  value={newTraitValue}
                  onChange={(e) => setNewTraitValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrait()}
                  placeholder="Value (e.g. heights)"
                />
                <button
                  className={styles.milestoneAddBtn}
                  onClick={addTrait}
                  disabled={!newTraitKey.trim()}
                >
                  <Plus size={13} />
                </button>
              </div>
            </SectionCard>

            {/* ── Reference Images ── */}
            {storyId && (
              <AssetPicker
                storyId={storyId}
                objectType="character"
                objectId={character.id}
              />
            )}

          </div>
        )}
      </div>

      {showAiGenerator && (
        <AttributeGeneratorPanel
          character={character}
          onClose={() => setShowAiGenerator(false)}
        />
      )}

      {editing && (
        <CharacterFormDialog
          storyId={storyId!}
          character={character}
          onClose={() => setEditing(false)}
        />
      )}

      {showStartInterview && (
        <StartInterviewDialog
          character={character}
          onStarted={handleInterviewStarted}
          onClose={() => setShowStartInterview(false)}
        />
      )}
    </div>
  );
}
