import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./SectionCard.module.css";

interface Props {
  title: string;
  children: React.ReactNode;
  /** Controlled collapse state — if provided, use with onToggle */
  collapsed?: boolean;
  /** Called when header is clicked in controlled mode */
  onToggle?: () => void;
  /** Whether the card can be collapsed. Defaults true. */
  collapsible?: boolean;
  /** Visual variant */
  variant?: "default" | "ai" | "intent" | "accent";
  /** Extra class on the outer card element */
  className?: string;
  /** Optional badge rendered next to the title (e.g. completion dots) */
  badge?: React.ReactNode;
}

export default function SectionCard({
  title,
  children,
  collapsed: collapsedProp,
  onToggle,
  collapsible = true,
  variant = "default",
  className,
  badge,
}: Props) {
  const [localCollapsed, setLocalCollapsed] = useState(false);

  const isControlled = collapsedProp !== undefined;
  const isCollapsed = isControlled ? collapsedProp : localCollapsed;

  function handleToggle() {
    if (onToggle) {
      onToggle();
    } else {
      setLocalCollapsed((c) => !c);
    }
  }

  const variantClass = variant === "ai" ? styles.ai : variant === "intent" ? styles.intent : variant === "accent" ? styles.accent : "";
  const cardClass = [styles.card, variantClass, className ?? ""].filter(Boolean).join(" ");

  if (!collapsible) {
    return (
      <div className={cardClass}>
        <div className={styles.headStatic}>
          <p className={styles.title}>{title}</p>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <button className={styles.head} onClick={handleToggle}>
        <span className={styles.titleRow}>
          <p className={styles.title}>{title}</p>
          {badge && <span className={styles.badge}>{badge}</span>}
        </span>
        <ChevronDown
          size={13}
          className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ""}`}
        />
      </button>
      {!isCollapsed && <div className={styles.body}>{children}</div>}
    </div>
  );
}
