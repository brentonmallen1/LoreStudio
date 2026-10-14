import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { tipFor } from "../../lib/typing/tips";
import { useTipStore } from "../../stores/tipStore";
import styles from "./TipLine.module.css";

/** No keys for this long is a pause (doc 26, D3). */
export const PAUSE_MS = 2000;
/** How long a tip stays, unless the pointer is on it. */
export const TIP_MS = 12000;

/**
 * A tip, above the status corner (doc 26, P4): the quicker way to do what the writer just did
 * the long way, shown at the next pause in typing and gone after a while. The first one says
 * where tips are turned off. Hidden while the corner's card is open.
 */
export default function TipLine({ hidden = false }: { hidden?: boolean }) {
  const pending = useTipStore((s) => s.pending);
  const showing = useTipStore((s) => s.showing);
  const [hover, setHover] = useState(false);

  // An offer waits for a pause: every key starts the wait again.
  useEffect(() => {
    if (!pending) return;
    let timer = setTimeout(() => useTipStore.getState().pause(), PAUSE_MS);
    function onKey() {
      clearTimeout(timer);
      timer = setTimeout(() => useTipStore.getState().pause(), PAUSE_MS);
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [pending]);

  useEffect(() => {
    if (!showing || hover) return;
    const timer = setTimeout(() => useTipStore.getState().dismiss(), TIP_MS);
    return () => clearTimeout(timer);
  }, [showing, hover]);

  if (!showing || hidden) return null;
  const { helper, line } = tipFor(showing.id);
  return (
    <div
      className={styles.tip}
      role="status"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className={styles.line}>{line}</p>
      <p className={styles.does}>{helper.does}</p>
      {showing.first && (
        <p className={styles.off}>
          Tips like this one can be turned off in{" "}
          <Link to="/settings#writing" onClick={() => useTipStore.getState().dismiss()}>
            Settings › Writing
          </Link>
          .
        </p>
      )}
      <button
        type="button"
        className={styles.close}
        aria-label="Close the tip"
        title="Close the tip"
        onClick={() => useTipStore.getState().dismiss()}
      >
        <X size={13} />
      </button>
    </div>
  );
}
