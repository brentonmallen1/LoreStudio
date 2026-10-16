import { assistantResultsApi } from "../../api/assistantResults";
import type { ProposedDialogueTag } from "../../types";

/**
 * The Assistant's speaker suggestions, kept on each scene (A7), by scene id: one call for the
 * whole story. Only for Studio: the caller asks only when the Assistant is on.
 */
export async function keptSpeakers(storyId: string): Promise<Map<string, ProposedDialogueTag[]>> {
  try {
    const rows = await assistantResultsApi.list(storyId, "node");
    return new Map(
      rows
        .filter((r) => r.feature === "dialogue-attribution")
        .map((r) => [r.subject_id, (r.data.suggestions as ProposedDialogueTag[] | undefined) ?? []]),
    );
  } catch {
    return new Map();
  }
}

const said = (text: string) => text.trim().toLowerCase();

/**
 * The rule-based proposals with the Assistant's kept word laid over them: a line it named a
 * speaker for takes its speaker and confidence. A line tagged since is not proposed at all,
 * so a kept suggestion for it simply finds nothing.
 */
export function withKeptSpeakers(
  proposals: ProposedDialogueTag[],
  kept: ProposedDialogueTag[] | undefined,
): ProposedDialogueTag[] {
  if (!kept?.length) return proposals;
  return proposals.map((p) => {
    const k = kept.find((s) => s.inferred_speaker && said(s.quote_content) === said(p.quote_content));
    return k
      ? {
          ...p,
          inferred_speaker: k.inferred_speaker,
          character_id: k.character_id,
          confidence: k.confidence,
          source_excerpt: k.source_excerpt || p.source_excerpt,
        }
      : p;
  });
}
