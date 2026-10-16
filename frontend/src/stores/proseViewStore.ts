import { create } from "zustand";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../lib/preferences/accountPrefs";

/**
 * How the prose editor shows its dialogue (2026-10-16), off by default and kept on the
 * account (`rememberPref`):
 *
 * - **Color dialogue by speaker:** a line said by a character, by its `<Name>` tag or as the
 *   server attributed it, sits on a soft tint of that character's palette slot with the slot's
 *   line under it. The words stay ink, so they read as the prose does in every palette.
 *
 * It is drawn by the editor's dialogue decorations (components/story/DialogueExtension.ts)
 * and an attribute on `<html>` (SceneEditor.module.css); the document never changes.
 */
interface ProseViewState {
  speakerColors: boolean;
  setSpeakerColors: (on: boolean) => void;
}

function read(key: "ls_speaker_colors"): boolean {
  try {
    return localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

function apply(speakerColors: boolean) {
  document.documentElement.dataset.speakerColors = speakerColors ? "on" : "off";
}

const saved = { speakerColors: read("ls_speaker_colors") };
apply(saved.speakerColors);

export const useProseViewStore = create<ProseViewState>((set) => ({
  ...saved,
  setSpeakerColors: (speakerColors) => {
    rememberPref("ls_speaker_colors", speakerColors ? "on" : "off");
    apply(speakerColors);
    set({ speakerColors });
  },
}));

// The account's choices replaced the browser's (another device chose them): show them.
window.addEventListener(PREFS_ADOPTED_EVENT, () => {
  const next = { speakerColors: read("ls_speaker_colors") };
  apply(next.speakerColors);
  useProseViewStore.setState(next);
});
