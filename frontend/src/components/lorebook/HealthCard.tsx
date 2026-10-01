import { findingsForEntity } from "../../lib/findings/group";
import { useOpenFindings } from "../../stores/findingsStore";
import FindingsCard from "../findings/FindingsCard";
import { SheetCard } from "./EntitySheet";

type Anchor = Parameters<typeof findingsForEntity>[1];

/**
 * A sheet's findings (doc 12 P4): what the checks say about this character, place,
 * thread or twist. Quiet when there is nothing (D3): no card at all.
 */
export default function HealthCard({ anchor, id, storyId }: { anchor: Anchor; id: string; storyId: string }) {
  const findings = findingsForEntity(useOpenFindings(), anchor, id);
  if (findings.length === 0) return null;
  return (
    <SheetCard title="Needs your eye" tone="warning" meta={findings.length}>
      <FindingsCard findings={findings} storyId={storyId} empty={null} />
    </SheetCard>
  );
}
