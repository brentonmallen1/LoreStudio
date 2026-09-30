import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import styles from "./BrowserShell.module.css";

export interface IndexItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match the path exactly (a page's first section sits at the page's own path). */
  end?: boolean;
  count?: number;
  /** Start a new group under this item's divider. */
  gap?: boolean;
}

/**
 * The browser shape (doc 12): an index of sections down the left, then the section's
 * body. Narrow, the index folds to its icons (container query, so a wide panel beside the
 * page folds it too). The body is the section's own list and sheet.
 */
export default function BrowserShell({
  title,
  items,
  children,
}: {
  title: string;
  items: IndexItem[];
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.index} aria-label={`${title} sections`}>
        <div className={styles.indexTitle}>{title}</div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key}>
              {item.gap && <div className={styles.gap} aria-hidden />}
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${styles.item} ${isActive ? styles.itemOn : ""}`}
                title={item.label}
              >
                <Icon size={15} aria-hidden />
                <span className={styles.label}>{item.label}</span>
                {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
              </NavLink>
            </div>
          );
        })}
      </nav>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
