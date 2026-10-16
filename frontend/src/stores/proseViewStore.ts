import { create } from "zustand";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../lib/preferences/accountPrefs";

/**
 * How the prose editor shows its dialogue (2026-10-16), both off by default and kept on the
 * account (`rememberPref`):
 *
 * - **Color dialogue by speaker:** a line said by a character, by its `<Name>` tag or as the
 *   server attributed it, sits on a soft tint of that character's palette slot with the slot's
 *   line under it. The words stay ink, so they read as the prose does in every palette.
 * - **Hide speaker tags:** the `<Name>` after a line is hidden while the caret is elsewhere,
 *   shown again while it is in that line or its tag, and named on hover.
 *
 * Both are drawn by the editor's dialogue decorations (components/story/DialogueExtension.ts)
 * and these attributes on `<html>` (SceneEditor.module.css); the document never changes.
 */
interface ProseViewState {
  speakerColors: boolean;
  setSpeakerColors: (on: boolean) => void;
  hideSpeakerTags: boolean;
  setHideSpeakerTags: (on: boolean) => void;
}

function read(key: "ls_speaker_colors" | "ls_hide_speaker_tags"): boolean {
  try {
    return localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

function apply(speakerColors: boolean, hideSpeakerTags: boolean) {
  const root = document.documentElement;
  root.dataset.speakerColors = speakerColors ? "on" : "off";
  root.dataset.speakerTags = hideSpeakerTags ? "hidden" : "shown";
}

const saved = { speakerColors: read("ls_speaker_colors"), hideSpeakerTags: read("ls_hide_speaker_tags") };
apply(saved.speakerColors, saved.hideSpeakerTags);

export const useProseViewStore = create<ProseViewState>((set, get) => ({
  ...saved,
  setSpeakerColors: (speakerColors) => {
    rememberPref("ls_speaker_colors", speakerColors ? "on" : "off");
    apply(speakerColors, get().hideSpeakerTags);
    set({ speakerColors });
  },
  setHideSpeakerTags: (hideSpeakerTags) => {
    rememberPref("ls_hide_speaker_tags", hideSpeakerTags ? "on" : "off");
    apply(get().speakerColors, hideSpeakerTags);
    set({ hideSpeakerTags });
  },
}));

// The account's choices replaced the browser's (another device chose them): show them.
window.addEventListener(PREFS_ADOPTED_EVENT, () => {
  const next = { speakerColors: read("ls_speaker_colors"), hideSpeakerTags: read("ls_hide_speaker_tags") };
  apply(next.speakerColors, next.hideSpeakerTags);
  useProseViewStore.setState(next);
});
