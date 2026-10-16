import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import InlineText from "./InlineText";
import styles from "./EmptyState.module.css";

export interface EmptyStateCopy {
  /** What this is, as a question or a name: "Who is in your story?" */
  title: string;
  /** What it is, in a few plain words. Text may mark `code` and **bold**. */
  what: string;
  /** Why it helps the writing, not the app. */
  why?: string;
  /** The quicker way, if there is one: "Or type `@` and a name while you write." */
  quicker?: string;
  /** From The Last Lighthouse: the name in bold, then the rest. */
  example?: { name: string; text: string };
  /** The page's guide, and the words of its link. */
  guide?: { id: string; label: string };
}

export interface EmptyStateAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
}

/**
 * One rule for an empty page (doc 30 D3), in this order: what this is, why it helps the
 * writing, how to start (one forest button, and the quicker way if there is one), an example
 * from The Last Lighthouse, and its guide. The way out is never the Assistant's alone: a page
 * that has one in Studio still has its own action in Writer mode.
 *
 * `size="small"` is for a narrow place (a side-panel tool, a list column): what it is, how to
 * start and the guide, closer together, without the why or the example.
 */
export default function EmptyState({
  copy,
  action,
  extra,
  size = "page",
}: {
  copy: EmptyStateCopy;
  action?: EmptyStateAction;
  /** Below the action: a second, quieter way in that is not a link (a filter to clear). */
  extra?: ReactNode;
  size?: "page" | "small";
}) {
  const Icon = action?.icon;
  const body = (
    <>
      {Icon && <Icon size={14} aria-hidden />}
      {action?.label}
    </>
  );
  return (
    <section className={styles.empty} data-size={size} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      <p className={styles.what}>
        <InlineText text={copy.what} />
      </p>
      {copy.why && size === "page" && (
        <p className={styles.why}>
          <InlineText text={copy.why} />
        </p>
      )}
      {(action || copy.quicker || extra) && (
        <div className={styles.start}>
          {action &&
            (action.to ? (
              <Link to={action.to} className={styles.primary}>
                {body}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {body}
              </button>
            ))}
          {copy.quicker && (
            <span className={styles.quicker}>
              <InlineText text={copy.quicker} />
            </span>
          )}
          {extra}
        </div>
      )}
      {copy.example && size === "page" && (
        <div className={styles.example}>
          <span className={styles.exampleLabel}>For example, from The Last Lighthouse</span>
          <span>
            <strong>{copy.example.name}</strong>
            {copy.example.text}
          </span>
        </div>
      )}
      {copy.guide && (
        <Link to={`/guides/${copy.guide.id}`} className={styles.guide}>
          {copy.guide.label}
        </Link>
      )}
    </section>
  );
}
