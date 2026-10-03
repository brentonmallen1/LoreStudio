/**
 * Custom TipTap search-and-replace extension using ProseMirror decorations.
 * Provides inline highlighting of matches and commands for navigation/replace.
 */
import { Extension } from "@tiptap/core";
import { forEachBlockText } from "../../lib/prose/blockText";
import { findInText } from "../../lib/prose/find";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const SEARCH_PLUGIN_KEY = new PluginKey("lorestudio-search");

export interface SearchStorage {
  term: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  resultCount: number;
  currentIndex: number;
}

interface SearchMatch {
  from: number;
  to: number;
}

function getMatches(
  doc: ProseMirrorNode,
  term: string,
  caseSensitive: boolean,
  wholeWord = false,
): SearchMatch[] {
  const results: SearchMatch[] = [];
  if (!term) return results;
  // A paragraph at a time ("the Ardent" is found when Ardent is in italics), and never in
  // the syntax around the words: a replace cannot rewrite a speaker tag or a mention's @.
  forEachBlockText(doc, (block) => {
    for (const [start, end] of findInText(block.text, term, { caseSensitive, wholeWord }))
      results.push(block.range(start, end));
  });
  return results;
}

export const SearchAndReplaceExtension = Extension.create<object, SearchStorage>({
  name: "lorestudioSearch",

  addStorage(): SearchStorage {
    return { term: "", caseSensitive: false, wholeWord: false, resultCount: 0, currentIndex: 0 };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          this.storage.term = term;
          this.storage.currentIndex = 0;
          const matches = getMatches(
            editor.state.doc,
            term,
            this.storage.caseSensitive,
            this.storage.wholeWord,
          );
          this.storage.resultCount = matches.length;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      setSearchCaseSensitive:
        (cs: boolean) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          this.storage.caseSensitive = cs;
          const matches = getMatches(editor.state.doc, this.storage.term, cs, this.storage.wholeWord);
          this.storage.resultCount = matches.length;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      setSearchWholeWord:
        (whole: boolean) =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          this.storage.wholeWord = whole;
          this.storage.currentIndex = 0;
          const matches = getMatches(editor.state.doc, this.storage.term, this.storage.caseSensitive, whole);
          this.storage.resultCount = matches.length;
          editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
          return true;
        },

      goToNextSearchResult:
        () =>
        ({ editor }: { editor: import("@tiptap/core").Editor }) => {
          const matches = getMatches(
            editor.state.doc,
            this.storage.term,
            this.storage.caseSensitive,
            this.storage.wholeWord,
          );
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
          const matches = getMatches(
            editor.state.doc,
            this.storage.term,
            this.storage.caseSensitive,
            this.storage.wholeWord,
          );
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

      // Both replace commands change the command's own transaction: dispatching another
      // from inside a command left TipTap applying a stale one ("mismatched transaction").
      replaceCurrentSearchResult:
        (replacement: string) =>
        ({ tr, dispatch }: { tr: import("@tiptap/pm/state").Transaction; dispatch?: unknown }) => {
          const { term, caseSensitive, wholeWord } = this.storage;
          const matches = getMatches(tr.doc, term, caseSensitive, wholeWord);
          if (matches.length === 0) return false;
          if (!dispatch) return true;
          const match = matches[this.storage.currentIndex] ?? matches[0];
          // insertText keeps the words' marks (a replaced word in italics stays italic).
          if (replacement) tr.insertText(replacement, match.from, match.to);
          else tr.delete(match.from, match.to);
          const left = getMatches(tr.doc, term, caseSensitive, wholeWord);
          this.storage.resultCount = left.length;
          this.storage.currentIndex = Math.min(this.storage.currentIndex, Math.max(0, left.length - 1));
          return true;
        },

      replaceAllSearchResults:
        (replacement: string) =>
        ({ tr, dispatch }: { tr: import("@tiptap/pm/state").Transaction; dispatch?: unknown }) => {
          const { term, caseSensitive, wholeWord } = this.storage;
          const matches = getMatches(tr.doc, term, caseSensitive, wholeWord);
          if (matches.length === 0) return false;
          if (!dispatch) return true;
          // In reverse, so earlier positions stay valid.
          for (let i = matches.length - 1; i >= 0; i--) {
            const { from, to } = matches[i];
            if (replacement) tr.insertText(replacement, from, to);
            else tr.delete(from, to);
          }
          this.storage.resultCount = getMatches(tr.doc, term, caseSensitive, wholeWord).length;
          this.storage.currentIndex = 0;
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
            const { term, caseSensitive, wholeWord, currentIndex } = storage;
            if (!term) return DecorationSet.empty;
            const matches = getMatches(state.doc, term, caseSensitive, wholeWord);
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
