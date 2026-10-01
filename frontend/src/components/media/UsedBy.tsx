import { Link } from "react-router-dom";
import { sectionPath } from "../../lib/routes";
import { flattenStructure } from "../editor/segmentMeta";
import { useStoryStore } from "../../stores/storyStore";
import type { AssetAttachment } from "../../types";
import styles from "./MediaLibrary.module.css";

/**
 * Where an image is used (doc 12 P6): the portrait of a character, a place's picture, a
 * scene's attachment. Each is a link, so the Compendium answers "what is this for?".
 */
export default function UsedBy({ attachments }: { attachments: AssetAttachment[] }) {
  const { activeStory, characters, locations, structure } = useStoryStore();
  if (!activeStory || attachments.length === 0) return null;
  const nodes = new Map(flattenStructure(structure).map((n) => [n.id, n]));
  const links = attachments
    .map((a) => {
      if (a.object_type === "character") {
        const c = characters.find((x) => x.id === a.object_id);
        return (
          c && { key: a.id, name: c.name, to: sectionPath(activeStory.id, "lorebook", "characters", c.id) }
        );
      }
      if (a.object_type === "location") {
        const l = locations.find((x) => x.id === a.object_id);
        return l && { key: a.id, name: l.name, to: sectionPath(activeStory.id, "lorebook", "places", l.id) };
      }
      const n = nodes.get(a.object_id);
      return n && { key: a.id, name: n.title || "Untitled", to: `/stories/${activeStory.id}/write/${n.id}` };
    })
    .filter((x): x is { key: string; name: string; to: string } => !!x);
  if (links.length === 0) return null;
  return (
    <p className={styles.usedBy}>
      Used by{" "}
      {links.map((l, i) => (
        <span key={l.key}>
          {i > 0 && ", "}
          <Link to={l.to}>{l.name}</Link>
        </span>
      ))}
    </p>
  );
}
