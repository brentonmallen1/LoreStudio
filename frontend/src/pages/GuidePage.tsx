import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Compass } from "lucide-react";
import { GUIDES, forMode, guidesFor } from "../guides";
import { useMode } from "../lib/mode";
import { formatCombo } from "../lib/keyboard/shortcuts";
import styles from "./GuidePage.module.css";

/** /guides and /guides/:guideId — how to use LoreStudio, rendered from src/guides/*.md. */
export default function GuidePage() {
  const { guideId } = useParams<{ guideId?: string }>();
  const mode = useMode();
  const guides = guidesFor(mode);
  const guide = GUIDES.find((g) => g.id === guideId) ?? guides[0];

  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="Guides">
        <p className={styles.navTitle}>
          <Compass size={13} /> Guides
        </p>
        {guides.map((g) => (
          <Link
            key={g.id}
            to={`/guides/${g.id}`}
            className={`${styles.navLink} ${g.id === guide?.id ? styles.navLinkActive : ""}`}
          >
            {g.title}
          </Link>
        ))}
        <Link to="/settings#shortcuts" className={styles.navLink}>
          Keyboard shortcuts
        </Link>
        <p className={styles.navHint}>
          Type ? in the palette ({formatCombo("mod+k")}) to open a guide from anywhere.
        </p>
      </nav>
      <article className={styles.article}>
        {guide ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // A link to another guide or page stays in the app; anything else opens apart.
              a: ({ href = "", children }) =>
                href.startsWith("/") ? (
                  <Link to={href}>{children}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
            }}
          >
            {forMode(guide.body, mode)}
          </ReactMarkdown>
        ) : (
          <p>No guide selected.</p>
        )}
      </article>
    </div>
  );
}
