import { useState } from "react";
import { Search, User, MapPin } from "lucide-react";
import { api } from "../../api/client";
import type { EntitySuggestionsResponse, EntitySuggestion } from "../../types";
import styles from "./EntitySuggestionsPanel.module.css";

function SuggestionRow({ suggestion }: { suggestion: EntitySuggestion }) {
  return (
    <div className={styles.suggestionRow}>
      <div className={styles.suggestionName}>{suggestion.text}</div>
      <div className={styles.suggestionMeta}>
        {suggestion.occurrences} occurrence{suggestion.occurrences !== 1 ? "s" : ""} in{" "}
        {suggestion.scene_count} scene{suggestion.scene_count !== 1 ? "s" : ""}
      </div>
      {suggestion.scene_titles.length > 0 && (
        <div className={styles.sceneTitles}>
          {suggestion.scene_titles.slice(0, 3).join(", ")}
          {suggestion.scene_titles.length > 3 && ` +${suggestion.scene_titles.length - 3} more`}
        </div>
      )}
    </div>
  );
}

interface GroupProps {
  title: string;
  icon: React.ReactNode;
  suggestions: EntitySuggestion[];
}

function SuggestionGroup({ title, icon, suggestions }: GroupProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        {icon}
        <span className={styles.groupTitle}>{title}</span>
        <span className={styles.groupCount}>{suggestions.length}</span>
      </div>
      <div className={styles.groupList}>
        {suggestions.map(s => (
          <SuggestionRow key={s.text} suggestion={s} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  storyId: string;
}

export default function EntitySuggestionsPanel({ storyId }: Props) {
  const [result, setResult] = useState<EntitySuggestionsResponse | null>(null);
  const [running, setRunning] = useState(false);

  async function scan() {
    setResult(null);
    setRunning(true);
    try {
      const r = await api.analyzeEntitySuggestions(storyId);
      setResult(r);
    } catch {
      // leave result null
    } finally {
      setRunning(false);
    }
  }

  const totalSuggestions = (result?.character_suggestions.length ?? 0) + (result?.location_suggestions.length ?? 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Search size={13} className={styles.icon} />
          <div>
            <h3 className={styles.title}>Lorebook Suggestions</h3>
            <p className={styles.subtitle}>
              Named entities found in prose but not yet in your Lorebook
            </p>
          </div>
        </div>
        <button onClick={scan} disabled={running} className={styles.scanBtn}>
          <Search size={12} />
          {running ? "Scanning…" : result ? "Re-scan" : "Scan"}
        </button>
      </div>

      {running && <p className={styles.hint}>Scanning scenes for named entities…</p>}

      {!running && result && (
        <div className={styles.results}>
          {totalSuggestions === 0 ? (
            <p className={styles.hint}>No unrecognized named entities found.</p>
          ) : (
            <>
              <p className={styles.summary}>
                {totalSuggestions} potential Lorebook entr{totalSuggestions !== 1 ? "ies" : "y"} found in prose
              </p>
              <SuggestionGroup
                title="Characters"
                icon={<User size={12} className={styles.groupIcon} />}
                suggestions={result.character_suggestions}
              />
              <SuggestionGroup
                title="Locations"
                icon={<MapPin size={12} className={styles.groupIcon} />}
                suggestions={result.location_suggestions}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
