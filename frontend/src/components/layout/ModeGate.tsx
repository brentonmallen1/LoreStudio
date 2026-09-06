import { Link } from "react-router-dom";
import { useAIAvailable, useMode } from "../../lib/mode";
import type { StoryRoute } from "../../lib/routes";
import styles from "./ModeGate.module.css";

/**
 * Wraps a story page. In Writer mode, Studio-only pages show a quiet notice with a link to
 * Settings instead of rendering (refactor doc 04 §1: absent, not greyed out).
 */
export default function ModeGate({ route, children }: { route: StoryRoute; children: React.ReactNode }) {
  const mode = useMode();
  const aiAvailable = useAIAvailable();

  // An AI-only page is unreachable with the switch off, not just in Writer mode.
  if (route.ai && !aiAvailable) {
    return (
      <div className={styles.wrap} role="status">
        <p className={styles.title}>{route.label} needs AI, which is switched off.</p>
        <p className={styles.text}>
          {mode === "writer" ? (
            <>
              Writer mode keeps the manuscript tools and hides AI features. Switch modes in{" "}
              <Link to="/settings#appearance">Settings › Appearance</Link>.
            </>
          ) : (
            <>
              Turn AI back on in <Link to="/settings#ai">Settings › AI</Link>.
            </>
          )}
        </p>
      </div>
    );
  }
  if (route.modes.includes(mode)) return <>{children}</>;
  return (
    <div className={styles.wrap} role="status">
      <p className={styles.title}>{route.label} is part of Studio mode.</p>
      <p className={styles.text}>
        Writer mode keeps the manuscript tools and hides AI features. Switch modes in{" "}
        <Link to="/settings#appearance">Settings › Appearance</Link>.
      </p>
    </div>
  );
}
