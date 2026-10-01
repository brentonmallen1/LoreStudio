import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw, Settings2 } from "lucide-react";
import AutoTagPanel from "../components/cleanup/AutoTagPanel";
import Modal from "../components/common/Modal";
import type { MenuItem } from "../components/common/PopoverMenu";
import DiscoverySettings from "../components/discovery/DiscoverySettings";
import PageHeader from "../components/layout/PageHeader";
import ProposalRow from "../components/proposals/ProposalRow";
import { useAIAvailable } from "../lib/mode";
import { sectionPath } from "../lib/routes";
import { ago } from "../lib/serverDate";
import { useOpenProposals, useProposalsStore } from "../stores/proposalsStore";
import { useStoryStore } from "../stores/storyStore";
import type { Proposal, ProposalKind } from "../types/proposals";
import styles from "../components/findings/Findings.module.css";

const KINDS: { id: ProposalKind; label: string; heading: string }[] = [
  { id: "person", label: "People", heading: "Someone new" },
  { id: "place", label: "Places", heading: "Somewhere new" },
  { id: "presence", label: "Who's here", heading: "Who is in a scene" },
  { id: "fact", label: "Facts", heading: "What the reader learns" },
  { id: "relationship", label: "Relationships", heading: "Between characters" },
  { id: "dialogue", label: "Dialogue", heading: "Lines with no speaker" },
];

/**
 * Proposals (doc 12 P5): everything the app noticed and the author has not decided, in one
 * inbox: names and places in the prose, the Codex's suggestions, suggested relationships,
 * dialogue with no speaker. Each has a yes that writes it into the Lorebook (undoably) and
 * a no that keeps it from asking again. Replaces Discoveries and the Codex review queue.
 */
export default function ProposalsPage({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const kind = KINDS.find((k) => k.id === params.get("kind"))?.id ?? null;
  const proposals = useOpenProposals();
  const data = useProposalsStore((s) => s.data);
  const looking = useProposalsStore((s) => s.looking);
  const { act, decline, lookAgain } = useProposalsStore.getState();
  const characters = useStoryStore((s) => s.characters);
  const aiAvailable = useAIAvailable();
  const [tagging, setTagging] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState<{ text: string; to?: string } | null>(null);

  const shown = kind ? proposals.filter((p) => p.kind === kind) : proposals;
  const groups = useMemo(
    () =>
      KINDS.map((k) => ({ ...k, items: shown.filter((p) => p.kind === k.id) })).filter((g) => g.items.length),
    [shown],
  );
  const count = (k: ProposalKind) => proposals.filter((p) => p.kind === k).length;
  const setKind = (k: ProposalKind | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (k) next.set("kind", k);
        else next.delete("kind");
        return next;
      },
      { replace: true },
    );

  async function onAct(p: Proposal, action: string) {
    const result = await act(p, action);
    if (result.open) return setTagging(result.open);
    const where =
      result.entity_type === "character"
        ? sectionPath(storyId, "lorebook", "characters", result.entity_id ?? undefined)
        : result.entity_type === "location"
          ? sectionPath(storyId, "lorebook", "places", result.entity_id ?? undefined)
          : undefined;
    setNotice({ text: p.subject ? `${p.subject} is in the Lorebook.` : "Done.", to: where });
  }

  const more: MenuItem[] = aiAvailable
    ? [
        {
          label: "What the Assistant looks for…",
          icon: Settings2,
          ai: true,
          onSelect: () => setSettings(true),
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Proposals"
        summary={
          data
            ? [
                proposals.length === 1 ? "1 waiting" : `${proposals.length} waiting`,
                `names last looked for ${ago(data.last_scan)}`,
              ].join(" · ")
            : "Reading the story…"
        }
        primary={{
          label: looking ? "Looking…" : "Look again",
          icon: RefreshCw,
          disabled: looking,
          onClick: () => void lookAgain(aiAvailable),
        }}
        chips={
          <div className={styles.chips} role="group" aria-label="Show only">
            <button type="button" className={styles.chip} aria-pressed={!kind} onClick={() => setKind(null)}>
              Everything <span className={styles.chipCount}>{proposals.length}</span>
            </button>
            {KINDS.filter((k) => count(k.id) > 0 || k.id === kind).map((k) => (
              <button
                key={k.id}
                type="button"
                className={styles.chip}
                aria-pressed={kind === k.id}
                onClick={() => setKind(kind === k.id ? null : k.id)}
              >
                {k.label} <span className={styles.chipCount}>{count(k.id)}</span>
              </button>
            ))}
          </div>
        }
        more={more}
      />
      <div className={styles.scroll}>
        <div className={styles.column}>
          {notice && (
            <p className={styles.notice} role="status">
              {notice.text}
              {notice.to && <Link to={notice.to}>Open it →</Link>}
            </p>
          )}
          {data && groups.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nothing waiting.</p>
              <p className={styles.emptyText}>
                When the prose names someone or somewhere the Lorebook does not have, or a line of dialogue
                has no speaker{aiAvailable ? ", or the Assistant suggests something" : ""}, it waits here for
                a yes or a no.
              </p>
              <button
                type="button"
                className={styles.verb}
                disabled={looking}
                onClick={() => void lookAgain(aiAvailable)}
              >
                Look through the prose now
              </button>
            </div>
          )}
          {groups.map((g) => (
            <section key={g.id} className={styles.group} aria-label={g.heading}>
              <h2 className={styles.groupTitle}>
                {g.heading}
                <span className={styles.groupSub}>{g.items.length}</span>
              </h2>
              {g.items.map((p) => (
                <ProposalRow key={p.id} proposal={p} storyId={storyId} onAct={onAct} onDecline={decline} />
              ))}
            </section>
          ))}
          {data && (
            <p className={styles.footer}>
              A yes can be undone like any edit. A no keeps it from asking again; dialogue asks again when the
              scene changes.
            </p>
          )}
        </div>
      </div>
      {tagging && (
        <Modal isOpen onClose={() => setTagging(null)} title="Tag the dialogue" size="lg">
          <AutoTagPanel
            mode="story"
            storyId={storyId}
            sceneId={tagging}
            characterNames={characters.map((c) => c.name)}
            onApplied={() => void useProposalsStore.getState().refetch()}
          />
        </Modal>
      )}
      {settings && (
        <Modal isOpen onClose={() => setSettings(false)} title="What the Assistant looks for">
          <DiscoverySettings storyId={storyId} />
        </Modal>
      )}
    </div>
  );
}
