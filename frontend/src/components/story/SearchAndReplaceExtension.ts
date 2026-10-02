/**
 * Custom TipTap search-and-replace extension using ProseMirror decorations.
 * Provides inline highlighting of matches and commands for navigation/replace.
 */
import { Extension } from "@tiptap/core";
import { forEachBlockText } from "../../lib/prose/blockText";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const SEARCH_PLUGIN_KEY = new PluginKey("lorestudio-search");

export interface SearchStorage {
  term: string;
  caseSensitive: boolean;
  resultCount: number;
  currentIndex: number;
}

interface SearchMatch {
  from: number;
  to: number;
}

function getMatches(doc: ProseMirrorNode, term: string, caseSensitive: boolean): SearchMatch[] {
  const results: SearchMatch[] = [];
  if (!term) return results;
  const needle = caseSensitive ? term : term.toLowerCase();

  // A paragraph at a time: "the Ardent" is found when Ardent is in italics.
  forEachBlockText(doc, (block) => {
    const text = caseSensitive ? block.text : block.text.toLowerCase();
    let start = 0;
    while (true) {
      const idx = text.indexOf(needle, start);
      if (idx === -1) break;
      results.push(block.range(idx, idx + needle.length));
      start = idx + 1;
    }
  });
  return results;
}

export const SearchAndReplaceExtension = Extension.create<object, SearchStorage>({
  name: "lorestudioSearch",

  addStorage(): SearchStorage {
    return { term: "", caseSensitive: false, resultCount: 0, currentIndex: 0 };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          this.storage.term = term;
          this.storage.currentIndex = 0;
          const matches = getMatches(editor.state.doc, term, this.storage.caseSensitive);
          this.storage.resultCount = matches.length;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      setSearchCaseSensitive:
        (cs: boolean) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          this.storage.caseSensitive = cs;
          const matches = getMatches(editor.state.doc, this.storage.term, cs);
          this.storage.resultCount = matches.length;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      goToNextSearchResult:
        () =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          const matches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive);
          if (matches.length === 0) return false;
          this.storage.currentIndex = (this.storage.currentIndex + 1) % matches.length;
          const match = matches[this.storage.currentIndex];
          const tr = editor.state.tr;
          tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to));
          tr.setMeta("addToHistory", false);
          tr.scrollIntoView();
          editor.view.dispatch(tr);
          return true;
        },

      goToPrevSearchResult:
        () =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          const matches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive);
          if (matches.length === 0) return false;
          this.storage.currentIndex = (this.storage.currentIndex - 1 + matches.length) % matches.length;
          const match = matches[this.storage.currentIndex];
          const tr = editor.state.tr;
          tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to));
          tr.setMeta("addToHistory", false);
          tr.scrollIntoView();
          editor.view.dispatch(tr);
          return true;
        },

      replaceCurrentSearchResult:
        (replacement: string) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          const matches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive);
          if (matches.length === 0) return false;
          const match = matches[this.storage.currentIndex] ?? matches[0];
          const tr = editor.state.tr;
          if (replacement) {
            tr.replaceWith(match.from, match.to, editor.state.schema.text(replacement));
          } else {
            tr.delete(match.from, match.to);
          }
          editor.view.dispatch(tr);
          // Refresh count after replace
          const newMatches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive);
          this.storage.resultCount = newMatches.length;
          this.storage.currentIndex = Math.min(this.storage.currentIndex, Math.max(0, newMatches.length - 1));
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      replaceAllSearchResults:
        (replacement: string) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          const matches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive);
          if (matches.length === 0) return false;
          // Iterate in reverse so earlier positions stay valid
          const tr = editor.state.tr;
          for (let i = matches.length - 1; i >= 0; i--) {
            const { from, to } = matches[i];
            if (replacement) {
              tr.replaceWith(from, to, editor.state.schema.text(replacement));
            } else {
              tr.delete(from, to);
            }
          }
          editor.view.dispatch(tr);
          this.storage.resultCount = 0;
          this.storage.currentIndex = 0;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },
    } as Record<string, unknown>;
  },

  addProseMirrorPlugins() {
    // Capture storage reference — the object is mutated by commands
    const storage = this.storage;
    return [
      new Plugin({
        key: SEARCH_PLUGIN_KEY,
        props: {
          decorations(state) {
            const { term, caseSensitive, currentIndex } = storage;
            if (!term) return DecorationSet.empty;
            const matches = getMatches(state.doc, term, caseSensitive);
            if (matches.length === 0) return DecorationSet.empty;
            const decorations = matches.map((match, idx) =>
              Decoration.inline(match.from, match.to, {
                class: idx === currentIndex ? "ls-search-current" : "ls-search-match",
              }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
