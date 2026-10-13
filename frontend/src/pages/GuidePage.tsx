import { Fragment, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Compass } from "lucide-react";
import { GUIDES, forMode, guidesFor } from "../guides";
import { useMode } from "../lib/mode";
import { formatCombo } from "../lib/keyboard/shortcuts";
import TypingGuide from "../components/typing/TypingGuide";
import PracticeSandbox from "../components/typing/PracticeSandbox";
import TutorialAgain from "../components/typing/TutorialAgain";
import SamplesLoader from "../components/samples/SamplesLoader";
import styles from "./GuidePage.module.css";

/** `<!-- name -->` on a line of its own; split keeps the name. */
const INSERT = /^<!-- (helpers|practice|tutorial|samples) -->$/m;
const INSERTS: Record<string, () => ReactNode> = {
  helpers: () => <TypingGuide />,
  practice: () => <PracticeSandbox />,
  tutorial: () => <TutorialAgain />,
  samples: () => <SamplesLoader />,
};

function Markdown({ text }: { text: string }) {
  return (
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
      {text}
    </ReactMarkdown>
  );
}

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
          <>
            {/* A guide's text can hold a piece of the app at a marker: the Typing guide's list,
                drawn from the helpers with a tick on each one used (doc 26, P2), and the practice
                page's sandbox (P5). */}
            {forMode(guide.body, mode)
              .split(INSERT)
              .map((part, i) =>
                i % 2 ? <Fragment key={i}>{INSERTS[part]?.()}</Fragment> : <Markdown key={i} text={part} />,
              )}
          </>
        ) : (
          <p>No guide selected.</p>
        )}
      </article>
    </div>
  );
}
