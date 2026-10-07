import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Orbit } from "lucide-react";
import { numbersApi } from "../../api/numbers";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { chapterStarts } from "../../lib/numbers/charts";
import type { Figures } from "../../lib/numbers/figures";
import { useAIAvailable } from "../../lib/mode";
import { toast } from "../../stores/toastStore";
import type { Talk as TalkData } from "../../types/numbers";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../llm";
import ChapterRow from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";
import own from "./Talk.module.css";

const WOMAN = /\bwom[ae]n\b/i;

/** "Named women", or the values themselves when another group is chosen. */
function groupWords(group: string[]): string {
  if (group.length > 0 && group.every((g) => WOMAN.test(g))) return "Named women";
  return `People whose gender you wrote as ${group.map((g) => `“${g}”`).join(" or ")}`;
}

/**
 * Talking to each other (doc 20 P7): the first part of the Bechdel–Wallace test measured on
 * the book's own dialogue, and in Studio the second described. Who counts comes from the
 * author's Gender field, one group at a time; it never says pass or fail.
 */
export default function Talk({ storyId, now }: { storyId: string; now: Figures }) {
  const [data, setData] = useState<TalkData | null>(null);
  const [group, setGroup] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);
  const aiAvailable = useAIAvailable();
  const transparency = useLLMTransparency();

  const load = useCallback(
    () =>
      numbersApi
        .talk(storyId, group)
        .then(setData)
        .catch(() => setData(null)),
    [storyId, group],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || data.values.length === 0) return null;
  const chosen = data.group;
  const byScene = new Map(data.scenes.map((s) => [s.node_id, s]));
  const starts = chapterStarts(now.chapters);
  const exchanges = data.scenes.flatMap((s) => s.exchanges);
  const described = exchanges.filter((e) => e.about);
  const notAboutAMan = described.filter((e) => e.about_a_man === false).length;

  async function describe() {
    setAsking(true);
    try {
      setData(await numbersApi.talkSubjects(storyId, group));
      transparency.recordInteraction();
    } catch {
      toast.error("The Assistant could not describe the conversations");
    } finally {
      setAsking(false);
    }
  }

  function toggle(value: string) {
    setGroup(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]);
  }

  return (
    <section className={styles.section} aria-labelledby="numbers-talk">
      <SectionHeading section="talk" title="Talking to each other" />
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <div className={own.group} role="group" aria-label="Whose conversations">
        <span className={own.groupLabel}>Gender values counted</span>
        {data.values.map((v) => (
          <label key={v.value} className={own.value}>
            <input type="checkbox" checked={chosen.includes(v.value)} onChange={() => toggle(v.value)} />
            {v.value} <span className={own.count}>{v.count}</span>
          </label>
        ))}
      </div>

      {chosen.length === 0 ? (
        <p className={styles.lede}>
          Choose which gender values count, and the scenes where they talk appear here.
        </p>
      ) : (
        <p className={styles.lede}>
          {groupWords(chosen)} ({data.people}) talk to each other in <strong>{data.scenes.length}</strong> of{" "}
          {data.scene_count} scenes
          {data.scenes.length > 0 && ": "}
          {data.scenes.map((s, i) => (
            <span key={s.node_id}>
              {i > 0 && ", "}
              <Link to={`/stories/${storyId}/write/${s.node_id}`}>{s.title}</Link>
            </span>
          ))}
          .
          {data.unattributed > 0 &&
            ` ${data.unattributed} ${data.unattributed === 1 ? "line" : "lines"} in their scenes have no speaker yet, so a conversation may be missing.`}
        </p>
      )}

      {data.scenes.length > 0 && (
        <div className={styles.score} style={{ "--cols": now.scenes.length } as React.CSSProperties}>
          <ChapterRow chapters={now.chapters} />
          <span className={styles.axisLabel}>Talking</span>
          <div className={styles.cols} role="group" aria-label="Scenes where they talk to each other">
            {now.scenes.map((s, i) => {
              const here = byScene.get(s.id);
              return (
                <span
                  key={s.id}
                  className={styles.cell}
                  data-level={here ? "pov" : undefined}
                  data-chapter={starts.has(i) || undefined}
                  style={{ "--who": "var(--color-text-muted)" } as React.CSSProperties}
                  title={
                    here
                      ? `${s.title}: ${here.exchanges.length} ${here.exchanges.length === 1 ? "conversation" : "conversations"}`
                      : s.title
                  }
                />
              );
            })}
          </div>
          <span />
        </div>
      )}

      {aiAvailable && exchanges.length > 0 && (
        <div className={own.studio}>
          <button type="button" className={styles.aiBtn} disabled={asking} onClick={() => void describe()}>
            <Orbit size={13} aria-hidden />
            {asking
              ? "Reading the conversations…"
              : described.length
                ? "Describe them again"
                : "What do they talk about"}
          </button>
          {described.length > 0 && (
            <>
              <span className={own.studioNote}>
                About something other than a man in {notAboutAMan} of {described.length}
              </span>
              <LLMTransparencyTrigger
                onClick={() =>
                  transparency.open({ context_type: "attributes" }, "", {
                    feature: "talk-subjects",
                    story_id: storyId,
                  })
                }
              />
            </>
          )}
        </div>
      )}
      {described.length > 0 && (
        <ul className={own.subjects} aria-label="What each conversation is about">
          {data.scenes.flatMap((s) =>
            s.exchanges
              .filter((e) => e.about)
              .map((e) => (
                <li key={e.id}>
                  <Link to={`/stories/${storyId}/write/${s.node_id}`}>{s.title}</Link>
                  <span className={own.about}>{e.about}</span>
                  {e.about_a_man && <span className={own.man}>about a man</span>}
                </li>
              )),
          )}
        </ul>
      )}
    </section>
  );
}
