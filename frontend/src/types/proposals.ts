/** The Proposals inbox (doc 12 P5): mirrors `backend/app/schemas/proposals.py`. */

export type ProposalKind = "place" | "person" | "dialogue" | "fact" | "presence" | "relationship";

export interface Proposal {
  id: string;
  kind: ProposalKind;
  source: "local" | "ai";
  text: string;
  subject: string;
  evidence: string;
  node_id: string | null;
  where: string;
  actions: { id: string; label: string; primary: boolean }[];
  decline: string;
  created_at: string | null;
}

export interface ProposalsOut {
  proposals: Proposal[];
  counts_by_kind: Partial<Record<ProposalKind, number>>;
  count: number;
  last_scan: string | null;
}

export interface ActResult {
  entity_type: string | null;
  entity_id: string | null;
  /** A scene whose tagging the page should open. */
  open: string | null;
}
