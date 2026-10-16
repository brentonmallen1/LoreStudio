import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAIAvailable } from "../../lib/mode";
import { formatOf } from "../../lib/storyFormat";
import { useStoryStore } from "../../stores/storyStore";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import PageContents from "../guides/PageContents";
import PageHeader from "../layout/PageHeader";
import { HeroStats } from "./StoryIdentityBits";
import {
  Compass,
  Form,
  Foundation,
  Substance,
  Summaries,
  Voice,
  type IdentityFields,
  type IdentityForm,
} from "./StoryIdentitySections";
import { IDENTITY_SECTIONS } from "./identitySections";
import { useWorkshopMenu } from "./useWorkshopMenu";
import styles from "./StoryIdentityPanel.module.css";

/**
 * Story identity: what the story is, how it is told, its shape, what it is about and where it
 * is going, in groups with a section rail beside them, or "Jump to" in a narrow panel (A4).
 */ export default function StoryIdentityPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory, characters } = useStoryStore();
  const navigate = useNavigate();
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workshop = useWorkshopMenu(storyId);

  const aiAvailable = useAIAvailable();
  const content = useRef<HTMLDivElement>(null);
  // The Summaries are the Assistant's: without it there is nothing under them to jump to.
  const sections = useMemo(
    () => IDENTITY_SECTIONS.filter((x) => aiAvailable || x.id !== "identity-summaries"),
    [aiAvailable],
  );
  const [fields, setFields] = useState<IdentityFields>({
    logline: "",
    author_name: "",
    genre: "",
    tone: "",
    intended_length: "",
    story_format: "prose",
    narrative_perspective: "",
    pov_character_id: "",
    themes: [],
    central_conflict: "",
    target_audience: "",
    narrative_intent: "",
    premise: "",
    working_style: "",
  });

  useEffect(() => {
    if (!activeStory) return;
    setFields({
      logline: activeStory.logline ?? "",
      author_name: activeStory.author_name ?? "",
      genre: activeStory.genre ?? "",
      tone: activeStory.tone ?? "",
      intended_length: activeStory.intended_length ?? "",
      story_format: formatOf(activeStory),
      narrative_perspective: activeStory.narrative_perspective ?? "",
      pov_character_id: activeStory.pov_character_id ?? "",
      themes: activeStory.themes ?? [],
      central_conflict: activeStory.central_conflict ?? "",
      target_audience: activeStory.target_audience ?? "",
      narrative_intent: activeStory.narrative_intent ?? "",
      premise: activeStory.premise ?? "",
      working_style: activeStory.working_style ?? "",
    });
  }, [activeStory?.id]);

  function scheduleSync(patch: Partial<typeof fields> & { beat_sheet_id?: string | null }) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const updated = await api.updateStory(storyId, patch);
      setActiveStory(updated);
    }, 900);
  }

  function update(key: keyof IdentityFields, value: string | string[]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    scheduleSync({ [key]: value });
  }

  function updatePovCharacter(id: string) {
    setFields((prev) => ({ ...prev, pov_character_id: id }));
    scheduleSync({ pov_character_id: id || null } as Parameters<typeof scheduleSync>[0]);
  }

  async function handleInjectBeatSheet(beatSheetId: string) {
    const result = await api.injectBeatSheet(storyId, beatSheetId);
    navigate(`/stories/${storyId}/plan?tab=${result.id}`);
  }

  function updateBeatSheet(id: string | null) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const updated = await api.updateStory(storyId, { beat_sheet_id: id });
      setActiveStory(updated);
    }, 300);
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  function toggle(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!activeStory) return null;

  const form: IdentityForm = { storyId, fields, update, collapsed, toggle };

  return (
    <div className={styles.panel}>
      <PageHeader
        title="Story identity"
        summary={<HeroStats storyId={storyId} />}
        aside={<AIFeatureInfoTrigger pageId="story-identity" />}
        more={workshop}
      />

      <div className={styles.scrollArea}>
        <div className={styles.layout}>
          <PageContents
            article={content}
            guideKey={`identity:${storyId}`}
            items={sections}
            address={false}
            railClassName={styles.rail}
            jumpClassName={styles.jump}
          />
          <div ref={content} className={styles.content}>
            <Foundation {...form} />
            <Voice {...form} characters={characters} onPovCharacter={updatePovCharacter} />
            <Form
              {...form}
              beatSheetId={activeStory.beat_sheet_id}
              onBeatSheet={updateBeatSheet}
              onInjectBeatSheet={handleInjectBeatSheet}
            />
            <Substance {...form} />
            <Compass {...form} goals={activeStory.goals ?? []} />
            {aiAvailable && <Summaries storyId={storyId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
