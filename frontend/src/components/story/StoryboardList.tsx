import { buildLine, type Stop } from "../../lib/strip/stripModel";
import { stationName } from "../../lib/panel/sequence";
import { navigateMain } from "../../lib/panel/panelSync";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./StoryboardList.module.css";

const STATUS_WORD: Record<string, string> = {
  planned: "planned",
  draft: "draft",
  revised: "revised",
  final: "final",
};

/**
 * The Storyboard beside the prose (doc 24 D2): one column of scene cards under their
 * chapters, each with its status as a shape; the scene open in the prose is marked and shows
 * its synopsis. Choosing a card opens that scene in the prose.
 */
export default function StoryboardList() {
  const { activeStory, activeNode, structure, activeTemplate, sceneCast } = useStoryStore();
  if (!activeStory) return null;
  const line = buildLine(structure, activeTemplate, activeNode?.id, sceneCast);
  if (line.stops.length === 0) {
    return <p className={styles.empty}>No scenes yet: the board fills as the book does.</p>;
  }
  const open = (stop: Stop) => navigateMain(`/stories/${activeStory.id}/write/${stop.node.id}`);

  return (
    <div className={styles.list}>
      {line.stations.map((station) => (
        <section key={station.key} className={styles.group} aria-label={station.title || undefined}>
          {line.hasStations && station.node && (
            <h3 className={styles.label}>
              {stationName(station, activeTemplate?.levels[station.node.level]?.name)}
            </h3>
          )}
          {station.stops.map((stop) => {
            const here = stop.node.id === activeNode?.id;
            return (
              <button
                key={stop.node.id}
                type="button"
                className={`${styles.card} ${here ? styles.cardOn : ""}`}
                aria-current={here ? "true" : undefined}
                title={here ? "Open in the prose now" : "Open this scene in the prose"}
                onClick={() => open(stop)}
              >
                <span className={styles.cardHead}>
                  <span className={`${styles.stop} ${styles[`stop_${stop.status}`] ?? ""}`} aria-hidden />
                  <span className={styles.title}>{stop.node.title || "Untitled"}</span>
                  <span className={styles.meta}>{here ? "writing" : STATUS_WORD[stop.status]}</span>
                </span>
                {here && stop.node.synopsis && <span className={styles.synopsis}>{stop.node.synopsis}</span>}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
