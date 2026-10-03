import { useState } from "react";
import { Layers, PenLine } from "lucide-react";
import { setMode, useMode } from "../../lib/mode";
import styles from "./GlobalHeader.module.css";

/**
 * Which mode you are in, always visible, and one click to change it.
 *
 * Writer mode renders no AI affordance, which means a feature you remember using is
 * simply not there — and with nothing on screen saying why, the app looks broken rather
 * than configured. The setting lives in Settings › Appearance too; this is the part that
 * answers "why can't I see the thing" without going looking.
 */
export default function ModeIndicator() {
  const mode = useMode();
  const [saving, setSaving] = useState(false);
  const writer = mode === "writer";

  async function toggle() {
    setSaving(true);
    try {
      await setMode(writer ? "studio" : "writer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      className={styles.modePill}
      data-mode={mode}
      onClick={toggle}
      disabled={saving}
      title={
        writer
          ? "Writer mode: no AI features are shown. Click to switch to Studio."
          : "Studio mode: everything, including AI. Click to switch to Writer."
      }
      aria-label={`Interface mode: ${writer ? "Writer" : "Studio"}. Click to switch.`}
    >
      {writer ? <PenLine size={14} /> : <Layers size={14} />}
      <span className={styles.modePillLabel}>{writer ? "Writer" : "Studio"}</span>
    </button>
  );
}
