import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, PanelRightOpen, type LucideIcon } from "lucide-react";
import PopoverMenu, { type MenuItem } from "../common/PopoverMenu";
import { openBesideTheProse } from "../../lib/panel/openBeside";
import { canOpenBeside } from "../../lib/panel/pages";
import { guideItem, usePageHere, type PageHere } from "./usePageAbout";
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
 * One header for every page that is not the prose (doc 12 P1): the title; under it what the
 * page is for (its `purpose` in `lib/routes.ts`, doc 30 D2), then one line of count or
 * summary, a view switch beside the title when the page has views,
 * filter chips if it filters, one primary action (the palette's accent), and everything else behind ⋯
 * (Assistant actions included, in their colour, so purple is not spread across headers).
 * A story's page gets "Open beside the prose" last under ⋯ (doc 24 D2), except where it is
 * already beside the prose, and "How this page works" closes the menu, opening the page's guide.
 * A page whose purpose needs more than a line passes `intro` in its place.
 */
export default function PageHeader({
  title,
  intro,
  guide: guideId,
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
  /** In place of the route's purpose line, when the page says more about itself. */
  intro?: ReactNode;
  /** The guide for a page outside a story's routes (a series), which has no route to say it. */
  guide?: string;
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
  const here = usePageHere();
  const beside = besideItem(here);
  const guide = guideItem(guideId ?? here.guide);
  const items = [...more, ...(beside ? [beside] : []), ...(guide ? [guide] : [])];
  const purpose = intro ?? here.purpose;
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
        <PopoverMenu label="More actions" trigger={<MoreHorizontal size={15} />} items={items} />
      </div>
      {purpose && <p className={styles.purpose}>{purpose}</p>}
      {summary && <div className={styles.summary}>{summary}</div>}
      {chips && <div className={styles.chips}>{chips}</div>}
    </header>
  );
}

/** "Open beside the prose" for the story page this header is on, when it can be. */
function besideItem({ route, section, inPanel }: PageHere): MenuItem | null {
  if (inPanel || !route || !canOpenBeside(route)) return null;
  return {
    key: "beside-the-prose",
    label: "Open beside the prose",
    icon: PanelRightOpen,
    onSelect: () => openBesideTheProse(route.id, section?.id),
  };
}
