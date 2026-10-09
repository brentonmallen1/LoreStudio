import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal, PanelRightOpen, type LucideIcon } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import { openBesideTheProse } from "../../lib/panel/openBeside";
import { canOpenBeside, routeAt, sectionAt, storyRelative } from "../../lib/panel/pages";
import { useStoryStore } from "../../stores/storyStore";
import { useInPanelPage } from "../panel/inPanelPage";
import styles from "./PageHeader.module.css";

export interface PageView {
  id: string;
  label: string;
  count?: number;
}

export interface PrimaryAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
}

/**
 * One header for every page that is not the prose (doc 12 P1): the title, one line of
 * count or summary under it, a view switch beside the title when the page has views,
 * filter chips if it filters, one primary action (the palette's accent), and everything else behind ⋯
 * (Assistant actions included, in their colour, so purple is not spread across headers).
 * A story's page gets "Open beside the prose" last under ⋯ (doc 24 D2), except where it is
 * already beside the prose.
 */
export default function PageHeader({
  title,
  summary,
  views,
  view,
  onView,
  chips,
  aside,
  primary,
  more = [],
}: {
  title: string;
  summary?: ReactNode;
  views?: PageView[];
  view?: string;
  onView?: (id: string) => void;
  chips?: ReactNode;
  /** Beside the actions: a search box, the AI feature info trigger. */
  aside?: ReactNode;
  primary?: PrimaryAction;
  more?: MenuItem[];
}) {
  const PrimaryIcon = primary?.icon;
  const beside = useBesideItem();
  const primaryBody = (
    <>
      {PrimaryIcon && <PrimaryIcon size={14} aria-hidden />}
      {primary?.label}
    </>
  );
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <h1 className={styles.title}>{title}</h1>
        {views && views.length > 1 && (
          <div className={styles.views} role="tablist" aria-label={`${title} views`}>
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view}
                className={`${styles.view} ${v.id === view ? styles.viewOn : ""}`}
                onClick={() => onView?.(v.id)}
              >
                {v.label}
                {v.count !== undefined && v.count > 0 && <span className={styles.count}>{v.count}</span>}
              </button>
            ))}
          </div>
        )}
        <div className={styles.spacer} />
        {aside}
        {primary &&
          (primary.to ? (
            <Link to={primary.to} className={styles.primary}>
              {primaryBody}
            </Link>
          ) : (
            <button
              type="button"
              className={styles.primary}
              onClick={primary.onClick}
              disabled={primary.disabled}
            >
              {primaryBody}
            </button>
          ))}
        <PopoverMenu
          label="More actions"
          trigger={<MoreHorizontal size={15} />}
          items={beside ? [...more, beside] : more}
        />
      </div>
      {summary && <div className={styles.summary}>{summary}</div>}
      {chips && <div className={styles.chips}>{chips}</div>}
    </header>
  );
}

/** "Open beside the prose" for the story page this header is on, when it can be. */
function useBesideItem(): MenuItem | null {
  const { pathname } = useLocation();
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const inPanel = useInPanelPage();
  if (inPanel || !storyId) return null;
  const rel = storyRelative(storyId, pathname);
  const route = rel === null ? undefined : routeAt(rel);
  if (!route || !canOpenBeside(route)) return null;
  const section = sectionAt(route, rel ?? "");
  return {
    key: "beside-the-prose",
    label: "Open beside the prose",
    icon: PanelRightOpen,
    onSelect: () => openBesideTheProse(route.id, section?.id),
  };
}
