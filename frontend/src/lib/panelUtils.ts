export interface PanelBlock {
  name: string;
  target?: string; // set when character is addressing another character directly
  text: string;
}

/**
 * Parse a panel response into per-character blocks.
 *
 * Handles three formats produced by the panel system prompt:
 *   [Name]: dialogue                  — character speaking to the author
 *   [Name to Target]: dialogue        — character speaking to another character
 *   [Name action]                     — non-verbal acknowledgment, rendered as italicized action
 *
 * Inline action cues within dialogue (e.g. [shifts uncomfortably]) are preserved in the text.
 */
export function parsePanelResponse(content: string): PanelBlock[] {
  const blocks: PanelBlock[] = [];
  const speakerRegex = /\[([^\]]+)\]:\s*/g;

  let lastIndex = 0;
  let lastSpeaker: { name: string; target?: string } | null = null;

  let match;
  while ((match = speakerRegex.exec(content)) !== null) {
    if (lastSpeaker) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ ...lastSpeaker, text });
    }

    const inside = match[1].trim();
    const toMatch = /^(.+?)\s+to\s+(.+)$/i.exec(inside);
    if (toMatch) {
      lastSpeaker = { name: toMatch[1].trim(), target: toMatch[2].trim() };
    } else {
      lastSpeaker = { name: inside };
    }
    lastIndex = speakerRegex.lastIndex;
  }

  if (lastSpeaker) {
    const text = content.slice(lastIndex).trim();
    if (text) blocks.push({ ...lastSpeaker, text });
  }

  // Fallback: no speaker brackets found — render as single unlabeled block
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ name: "", text: content.trim() });
  }

  return blocks;
}
