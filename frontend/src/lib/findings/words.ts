import type { FindingSeverity, FindingSource } from "../../types/findings";

/** How much a finding matters, in words: the mark's name, the key's line, the urgency view. */
export const SEVERITY_WORDS: Record<FindingSeverity, string> = {
  high: "Look at this first",
  mid: "Worth a look",
  low: "A small thing",
};

/** Who said so, in plain words (doc 30 D5). "data" is the story's own shape, read here. */
export const SOURCE_WORDS: Record<FindingSource, { label: string; key: string }> = {
  local: { label: "Checked here", key: "read in your prose, on this computer" },
  data: { label: "Story shape", key: "your threads, chapters and cast, on this computer" },
  ai: { label: "Assistant", key: "read by the AI" },
};
