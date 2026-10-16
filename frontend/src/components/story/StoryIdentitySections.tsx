import type { Character, StoryFormat, WorkingStyle } from "../../types";
import { lengthForm, lengthOptions } from "../../utils/wordCount";
import PerspectiveSummaryPanel from "../analysis/PerspectiveSummaryPanel";
import { SectionCard } from "../common";
import TropesInPlay from "../tropes/TropesInPlay";
import BeatSheetSelector from "./BeatSheetSelector";
import { FormatField, PerspectiveField } from "./StoryFormFields";
import { CharCount, CompletionDots, GroupLabel, SeriesCard } from "./StoryIdentityBits";
import { GoalsPanel, ThemeInput } from "./StoryIdentityLists";
import StorySummaryPanel from "./StorySummaryPanel";
import { IDENTITY_SECTIONS, type SectionId } from "./identitySections";
import { WORKING_STYLES } from "../../lib/workingStyle";
import styles from "./StoryIdentityPanel.module.css";
import Term from "../common/Term";

// Story identity's groups (A4), each under an h2 the section rail and "Jump to" point at.
// The panel keeps the fields and saves them; each group draws its part.

export interface IdentityFields {
  logline: string;
  author_name: string;
  genre: string;
  tone: string;
  intended_length: string;
  story_format: StoryFormat;
  narrative_perspective: string;
  pov_character_id: string;
  themes: string[];
  central_conflict: string;
  target_audience: string;
  narrative_intent: string;
  premise: string;
  /** How the writer likes to work (doc 29 D1): "plan", "discover", "both" or "". */
  working_style: WorkingStyle;
}

/** What every group is drawn from: the fields, how to change one, and which cards are folded. */
export interface IdentityForm {
  storyId: string;
  fields: IdentityFields;
  update: (key: keyof IdentityFields, value: string | string[]) => void;
  collapsed: Record<string, boolean>;
  toggle: (id: string) => void;
}

function Heading({ id }: { id: SectionId }) {
  const s = IDENTITY_SECTIONS.find((x) => x.id === id)!;
  return <GroupLabel id={s.id} label={s.text} description={s.hint} />;
}

/** The format's forms, and a length kept from the other format (after a switch) as it was. */
function lengthChoices(format: StoryFormat, current: string): [string, string][] {
  const options = lengthOptions(format);
  const kept = lengthForm(current);
  if (current && kept && !options.some(([k]) => k === current)) {
    options.push([current, `${kept.option}: a ${format === "prose" ? "script" : "prose"} length`]);
  }
  return options;
}

export function Foundation({ storyId, fields, update, collapsed, toggle }: IdentityForm) {
  const foundationFields = [fields.logline, fields.premise].filter(Boolean).length;
  return (
    <>
      <Heading id="identity-foundation" />
      <SectionCard
        title="Core identity"
        collapsed={!!collapsed.identity}
        onToggle={() => toggle("identity")}
        badge={foundationFields > 0 ? <CompletionDots filled={foundationFields} total={2} /> : undefined}
      >
        <div>
          <p className={styles.subFieldLabel}>
            <Term id="logline">Logline</Term>
          </p>
          <p className={styles.fieldHint}>
            One sentence: who wants what, against what obstacle, with what at stake.
          </p>
          <p className={styles.fieldPattern}>[Protagonist] must [goal] despite [obstacle], or [stakes]</p>
          <textarea
            value={fields.logline}
            onChange={(e) => update("logline", e.target.value)}
            placeholder="Elena must find the lighthouse keeper before…"
            className={styles.textarea}
            rows={2}
          />
          <div className={styles.fieldMeta}>
            <CharCount value={fields.logline} max={150} />
          </div>
        </div>
        <div>
          <p className={styles.subFieldLabel}>Author byline</p>
          <p className={styles.fieldHint}>
            Shown on the title page of exports. Leave blank to export without one.
          </p>
          <input
            value={fields.author_name}
            onChange={(e) => update("author_name", e.target.value)}
            placeholder="Pen name or real name"
            className={styles.input}
          />
        </div>
        <div>
          <p className={styles.subFieldLabel}>
            <Term id="premise">Premise</Term>
          </p>
          <p className={styles.fieldHint}>
            Expanded setup: the situation, the characters, and what's at stake.
          </p>
          <p className={styles.fieldPattern}>
            In [setting], [protagonist with flaw] faces [problem] when [
            <Term id="inciting-incident">inciting incident</Term>]…
          </p>
          <textarea
            value={fields.premise}
            onChange={(e) => update("premise", e.target.value)}
            placeholder="In a remote lighthouse station…"
            className={styles.textarea}
            rows={3}
          />
        </div>
      </SectionCard>

      <SectionCard title="Narrative intent" collapsed={!!collapsed.intent} onToggle={() => toggle("intent")}>
        <p className={styles.fieldHint}>
          What is this story about (meaning, not plot)? What question does it ask? What should the reader feel
          at the end?
        </p>
        <textarea
          value={fields.narrative_intent}
          onChange={(e) => update("narrative_intent", e.target.value)}
          placeholder="This story asks whether redemption is possible when…"
          className={styles.textarea}
          rows={3}
        />
      </SectionCard>

      <SeriesCard storyId={storyId} collapsed={!!collapsed.series} onToggle={() => toggle("series")} />
    </>
  );
}

export function Voice({
  fields,
  update,
  collapsed,
  toggle,
  characters,
  onPovCharacter,
}: IdentityForm & { characters: Character[]; onPovCharacter: (id: string) => void }) {
  return (
    <>
      <Heading id="identity-voice" />
      <SectionCard title="Style" collapsed={!!collapsed.style} onToggle={() => toggle("style")}>
        <div className={styles.row}>
          <div>
            <p className={styles.subFieldLabel}>Genre</p>
            <input
              value={fields.genre}
              onChange={(e) => update("genre", e.target.value)}
              placeholder="Literary fiction, thriller…"
              className={styles.input}
            />
          </div>
          <div>
            <p className={styles.subFieldLabel}>Tone</p>
            <input
              value={fields.tone}
              onChange={(e) => update("tone", e.target.value)}
              placeholder="Dark, hopeful, satirical…"
              className={styles.input}
            />
          </div>
        </div>
        {fields.story_format === "prose" && (
          <PerspectiveField
            perspective={fields.narrative_perspective}
            povCharacterId={fields.pov_character_id}
            characters={characters}
            onPerspective={(v) => update("narrative_perspective", v)}
            onPovCharacter={onPovCharacter}
          />
        )}
      </SectionCard>
    </>
  );
}

export function Form({
  storyId,
  fields,
  update,
  collapsed,
  toggle,
  beatSheetId,
  onBeatSheet,
  onShowOnOutline,
}: IdentityForm & {
  beatSheetId: string | null;
  onBeatSheet: (id: string | null) => void;
  onShowOnOutline: () => void;
}) {
  return (
    <>
      <Heading id="identity-form" />
      <SectionCard title="Structure" collapsed={!!collapsed.structure} onToggle={() => toggle("structure")}>
        <FormatField
          value={fields.story_format}
          onChange={(v) => update("story_format", v)}
          storyId={storyId}
        />
        <div>
          <label className={styles.subFieldLabel} htmlFor="identity-working-style">
            How you like to work
          </label>
          <p className={styles.fieldHint}>
            Where the story opens and the Overview's next step. Every tool stays available either way.
          </p>
          <select
            id="identity-working-style"
            value={fields.working_style}
            onChange={(e) => update("working_style", e.target.value)}
            className={styles.input}
          >
            {!fields.working_style && <option value="">Not chosen</option>}
            {WORKING_STYLES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className={styles.subFieldLabel}>Intended length</p>
          <p className={styles.fieldHint}>
            Target form and its length, in {fields.story_format === "prose" ? "words" : "pages"}. Used by
            Findings, Numbers and the Assistant.
          </p>
          <select
            value={fields.intended_length}
            onChange={(e) => update("intended_length", e.target.value)}
            className={styles.input}
          >
            {lengthChoices(fields.story_format, fields.intended_length).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className={styles.subFieldLabel}>
            <Term id="beat-sheet">Classic pattern</Term>
          </p>
          <p className={styles.fieldHint}>
            Optional. A list of moments many stories share, shown on your Outline so you can see which you
            have. It changes nothing in the story.
          </p>
          <BeatSheetSelector value={beatSheetId} onChange={onBeatSheet} onShowOnOutline={onShowOnOutline} />
        </div>
      </SectionCard>
    </>
  );
}

export function Substance({ storyId, fields, update, collapsed, toggle }: IdentityForm) {
  return (
    <>
      <Heading id="identity-substance" />
      <SectionCard
        title="Themes and conflict"
        collapsed={!!collapsed.themes}
        onToggle={() => toggle("themes")}
      >
        <div>
          <p className={styles.subFieldLabel}>Themes</p>
          <p className={styles.fieldHint}>Recurring ideas and motifs. Press Enter or comma to add.</p>
          <ThemeInput themes={fields.themes} onChange={(t) => update("themes", t)} />
        </div>
        <div>
          <p className={styles.subFieldLabel}>Central conflict</p>
          <p className={styles.fieldPattern}>
            [Character]'s need for [want] vs. [opposing force or internal flaw]
          </p>
          <textarea
            value={fields.central_conflict}
            onChange={(e) => update("central_conflict", e.target.value)}
            placeholder="Eleanor's need to protect her carefully constructed isolation versus…"
            className={styles.textarea}
            rows={2}
          />
        </div>
        <div>
          <p className={styles.subFieldLabel}>Target audience</p>
          <select
            value={fields.target_audience}
            onChange={(e) => update("target_audience", e.target.value)}
            className={styles.input}
          >
            <option value="">Not specified</option>
            <option value="kids">Kids (6–8)</option>
            <option value="middle_grade">Middle grade (8–12)</option>
            <option value="young_adult">Young adult (12–18)</option>
            <option value="new_adult">New adult (18–25)</option>
            <option value="adult">Adult</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Tropes in play" collapsed={!!collapsed.tropes} onToggle={() => toggle("tropes")}>
        <TropesInPlay storyId={storyId} />
      </SectionCard>
    </>
  );
}

export function Compass({
  storyId,
  collapsed,
  toggle,
  goals,
}: IdentityForm & { goals: { completed: boolean }[] }) {
  const goalsTotal = goals.length;
  const goalsComplete = goals.filter((g) => g.completed).length;
  return (
    <>
      <Heading id="identity-compass" />
      <SectionCard
        title="Story goals"
        collapsed={!!collapsed.goals}
        onToggle={() => toggle("goals")}
        badge={
          goalsTotal > 0 ? (
            <span className={styles.goalsBadge}>
              {goalsComplete}/{goalsTotal}
            </span>
          ) : undefined
        }
      >
        <p className={styles.fieldHint}>
          Explicit goals to hit as you write. Drag to reorder, double-click to edit.
        </p>
        <GoalsPanel storyId={storyId} />
      </SectionCard>
    </>
  );
}

/** The Assistant's summaries of the story: nothing without it, so no heading either. */
export function Summaries({ storyId }: { storyId: string }) {
  return (
    <>
      <Heading id="identity-summaries" />
      <StorySummaryPanel storyId={storyId} />
      <PerspectiveSummaryPanel storyId={storyId} />
    </>
  );
}
