import { ScanEye } from "lucide-react";
import { findingsForNode } from "../../../lib/findings/group";
import { useOpenFindings } from "../../../stores/findingsStore";
import type { StructureNode } from "../../../types";
import FindingsCard from "../../findings/FindingsCard";
import styles from "../SceneEditor.module.css";

/**
 * What needs your eye in this scene (doc 12 P4, D1): the scene's slice of the findings
 * feed, local and Assistant alike, with the same verbs as the Findings page, at the top of
 * the tab. Quiet when there is nothing (D3). It used to run its own consistency check at
 * the bottom; the feed already has those, and stays current as you write.
 */
export default function ChecksField({ activeNode }: { activeNode: StructureNode }) {
  const findings = findingsForNode(useOpenFindings(), activeNode.id);
  if (findings.length === 0) return null;
  return (
    <div className={styles.overviewField}>
      <label className={styles.overviewLabel}>
        <ScanEye size={11} className={styles.nlpIcon} /> Findings
      </label>
      <FindingsCard findings={findings} storyId={activeNode.story_id} here="scene" empty={null} />
    </div>
  );
}
