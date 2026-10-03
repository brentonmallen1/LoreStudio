import { ChevronUp } from "lucide-react";
import styles from "./CharacterDialogueTab.module.css";

/** The fold-away chevron on the dialogue tab's analysis panels, named for what it hides. */
export default function HidePanelButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={styles.voiceClose}>
      <ChevronUp size={12} />
    </button>
  );
}
