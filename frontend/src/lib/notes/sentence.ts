/**
 * The sentence around a point in a paragraph's text, as [start, end) offsets: what `/todo`
 * ties a to-do to when nothing is selected (doc 15 N1). A sentence ends at . ! ? or …,
 * with any closing quotes after it; leading and trailing spaces are left out.
 */
const END = /[.!?…]+["'”’)\]]*(?=\s|$)/g;

export function sentenceAround(text: string, offset: number): [number, number] {
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(END)) {
    const stop = (m.index ?? 0) + m[0].length;
    if (stop <= offset) start = stop;
    else {
      end = stop;
      break;
    }
  }
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return start < end ? [start, end] : [0, text.length];
}
