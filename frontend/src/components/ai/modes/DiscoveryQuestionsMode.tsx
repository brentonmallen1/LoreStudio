import { useState, useEffect } from "react";
import { Orbit, ChevronDown, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { useStoryStore } from "../../../stores/storyStore";
import { api } from "../../../api/client";
import AIModeWrapper from "../AIModeWrapper";
import type { DiscoveryQuestionsResponse, DiscoveryQuestion, Character, Location } from "../../../types";
import styles from "./DiscoveryQuestionsMode.module.css";

type FocusArea = "character" | "location" | "scene" | "story";

const FOCUS_OPTIONS: { value: FocusArea; label: string }[] = [
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "scene", label: "Scene" },
  { value: "story", label: "Story (overall)" },
];

function ContextAreaBadge({ area }: { area: string }) {
  return <span className={styles.areaBadge}>{area.replace(/_/g, " ")}</span>;
}

function QuestionCard({ q }: { q: DiscoveryQuestion }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} onClick={() => setOpen((o) => !o)}>
        <ContextAreaBadge area={q.context_area} />
        <span className={styles.cardQuestion}>{q.question}</span>
        <span className={styles.cardChevron}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>
      {open && q.why_this_matters && (
        <div className={styles.cardBody}>
          <p className={styles.cardBodyLabel}>Why this matters</p>
          <p className={styles.cardBodyText}>{q.why_this_matters}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  session: AISession;
}

export default function DiscoveryQuestionsMode({ session }: Props) {
  const state = useAIModeState(session);
  const storyId = session.context.storyId ?? "";

  const { characters: storeChars, structure } = useStoryStore();

  const [focusArea, setFocusArea] = useState<FocusArea>("character");
  const [entityId, setEntityId] = useState<string>("");

  const [characters, setCharacters] = useState<Character[]>(storeChars);
  const [locations, setLocations] = useState<Location[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);

  const [result, setResult] = useState<DiscoveryQuestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten scene tree for the scene picker
  function flattenScenes(
    nodes: import("../../../types").StructureNode[],
    depth = 0,
  ): { id: string; label: string; indent: number }[] {
    return nodes.flatMap((n) => [
      { id: n.id, label: n.title || "(untitled)", indent: depth },
      ...flattenScenes(n.children ?? [], depth + 1),
    ]);
  }
  const scenes = flattenScenes(structure);

  // Load characters and locations when needed
  useEffect(() => {
    if (!storyId) return;
    if (focusArea === "character" && characters.length === 0) {
      setEntityLoading(true);
      api
        .listCharacters(storyId)
        .then(setCharacters)
        .catch(() => {})
        .finally(() => setEntityLoading(false));
    }
    if (focusArea === "location") {
      setEntityLoading(true);
      api
        .listLocationsFlat(storyId)
        .then(setLocations)
        .catch(() => {})
        .finally(() => setEntityLoading(false));
    }
  }, [focusArea, storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset entity selection when focus area changes
  useEffect(() => {
    setEntityId("");
    setResult(null);
    setError(null);
  }, [focusArea]);

  // Auto-select first entity when list loads
  useEffect(() => {
    if (entityId) return;
    if (focusArea === "character" && characters.length > 0) {
      setEntityId(characters[0].id);
    } else if (focusArea === "location" && locations.length > 0) {
      setEntityId(locations[0].id);
    } else if (focusArea === "scene" && scenes.length > 0) {
      setEntityId(scenes[0].id);
    }
  }, [characters, locations, scenes, focusArea]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!storyId) return;
    if (focusArea !== "story" && !entityId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.generateDiscoveryQuestions(
        storyId,
        focusArea,
        focusArea !== "story" ? entityId : undefined,
      );
      if (res.success && res.data) {
        setResult(res.data as unknown as DiscoveryQuestionsResponse);
      } else {
        setError(res.raw_text || "Generation failed. Try again.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = focusArea === "story" || !!entityId;

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Orbit}
      title="Discovery Questions"
      hideTokenBadge
      hideSettings
    >
      <div className={styles.setup}>
        {/* Focus area selector */}
        <div className={styles.row}>
          <label className={styles.label}>Prompts for</label>
          <select
            className={styles.select}
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value as FocusArea)}
            disabled={loading}
          >
            {FOCUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Entity picker (hidden for story-level) */}
        {focusArea !== "story" && (
          <div className={styles.row}>
            <label className={styles.label}>
              {focusArea === "character" ? "Character" : focusArea === "location" ? "Location" : "Scene"}
            </label>
            {entityLoading ? (
              <span className={styles.entityLoading}>
                <Loader2 size={12} className={styles.spinner} /> Loading…
              </span>
            ) : (
              <select
                className={styles.select}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                disabled={loading}
              >
                {focusArea === "character" &&
                  characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                {focusArea === "location" &&
                  locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                {focusArea === "scene" &&
                  scenes.map((s) => (
                    <option key={s.id} value={s.id} style={{ paddingLeft: `${s.indent * 12}px` }}>
                      {"  ".repeat(s.indent)}
                      {s.label}
                    </option>
                  ))}
                {focusArea === "character" && characters.length === 0 && (
                  <option value="" disabled>
                    No characters yet
                  </option>
                )}
                {focusArea === "location" && locations.length === 0 && (
                  <option value="" disabled>
                    No locations yet
                  </option>
                )}
                {focusArea === "scene" && scenes.length === 0 && (
                  <option value="" disabled>
                    No scenes yet
                  </option>
                )}
              </select>
            )}
          </div>
        )}

        {/* Generate button */}
        <button className={styles.generateBtn} onClick={generate} disabled={loading || !canGenerate}>
          {loading ? (
            <>
              <Loader2 size={13} className={styles.spinner} /> Generating…
            </>
          ) : result ? (
            <>
              <RefreshCw size={13} /> Generate more
            </>
          ) : (
            <>
              <Orbit size={13} /> Generate questions
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={generate}>
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>
          {result.observation && <p className={styles.observation}>{result.observation}</p>}
          {result.questions.map((q, i) => (
            <QuestionCard key={i} q={q} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className={styles.empty}>
          <Orbit size={24} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Discovery Questions</p>
          <p className={styles.emptyHint}>
            Select what you're developing and generate 3–5 tailored questions to help you think more deeply
            about it.
          </p>
        </div>
      )}
    </AIModeWrapper>
  );
}
