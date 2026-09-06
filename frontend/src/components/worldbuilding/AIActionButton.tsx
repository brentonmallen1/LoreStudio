import { Compass } from "lucide-react";
import AIOnly from "../ai/AIOnly";
import styles from "./WorldBuilding.module.css";

/**
 * A worldbuilding button that opens the AI panel — and renders nothing where AI does not
 * belong.
 *
 * Every one of these was written out by hand, which is how six of them ended up visible
 * in writer mode: a dead control the author cannot use and cannot explain. One component
 * means one gate, and the next one added inherits it.
 */
export default function AIActionButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <AIOnly>
      <button className={styles.aiBtn} title={title} onClick={onClick}>
        <Compass size={11} />
        {label}
      </button>
    </AIOnly>
  );
}
