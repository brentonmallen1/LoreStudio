import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { sectionPath } from "../../lib/routes";
import { useProposalsStore } from "../../stores/proposalsStore";
import { toast } from "../../stores/toastStore";
import type { Proposal } from "../../types/proposals";
import styles from "../findings/Findings.module.css";
import ProposalRow from "./ProposalRow";

/**
 * Proposals › Imported (doc 28): what each import brought with no home chosen yet, one group
 * per import, with its report and the two ways to settle the rest at once. Either is one
 * change, so one undo puts it all back.
 */
export default function ImportedGroups({
  storyId,
  items,
  onAct,
}: {
  storyId: string;
  items: Proposal[];
  onAct: (p: Proposal, action: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { decline, refetch } = useProposalsStore.getState();
  const groups = [...new Set(items.map((p) => p.group ?? ""))].map((id) => ({
    id,
    where: items.find((p) => p.group === id)?.where ?? "From an import",
    items: items.filter((p) => (p.group ?? "") === id),
  }));

  async function settle(recordId: string, how: "keep" | "decline") {
    setBusy(true);
    try {
      await api.settleImported(storyId, recordId, how);
      await refetch();
    } catch {
      toast.error(how === "keep" ? "Those could not be kept" : "Those could not be set aside");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className={styles.group} aria-label={g.where}>
          <h2 className={styles.groupTitle}>
            {g.where}
            <span className={styles.groupSub}>{g.items.length} to sort</span>
            {g.id && (
              <span className={styles.groupActions}>
                <Link className={styles.verb} to={`${sectionPath(storyId, "chronicle", "imports", g.id)}`}>
                  The import's report
                </Link>
                <button
                  type="button"
                  className={styles.verb}
                  disabled={busy}
                  onClick={() => void settle(g.id, "keep")}
                >
                  Keep the rest in the Compendium
                </button>
                <button
                  type="button"
                  className={styles.no}
                  disabled={busy}
                  onClick={() => void settle(g.id, "decline")}
                >
                  Don't need any of these
                </button>
              </span>
            )}
          </h2>
          {g.items.map((p) => (
            <ProposalRow key={p.id} proposal={p} storyId={storyId} onAct={onAct} onDecline={decline} />
          ))}
        </section>
      ))}
    </>
  );
}
