import StarterKit, { type StarterKitOptions } from "@tiptap/starter-kit";

/**
 * StarterKit as every LoreStudio editor has had it. Tiptap 3 added links, underline, a list
 * keymap and a trailing empty paragraph to the kit; the prose keeps exactly what the author
 * typed, so none of them join.
 */
export function proseStarterKit(options: Partial<StarterKitOptions> = {}) {
  return StarterKit.configure({
    link: false,
    underline: false,
    listKeymap: false,
    trailingNode: false,
    ...options,
  });
}
