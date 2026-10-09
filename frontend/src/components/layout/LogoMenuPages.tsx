import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  routesFor,
  sectionModes,
  sectionPath,
  storyPath,
  type Domain,
  type StoryRoute,
  type RouteSection,
} from "../../lib/routes";
import { useAIAvailable, useMode } from "../../lib/mode";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./LogoMenu.module.css";

/** The menu's groups, each a run of domains from `lib/routes.ts`, in the table's order. */
const GROUPS: { label: string; domains: Domain[] }[] = [
  { label: "Write", domains: ["home", "manuscript"] },
  { label: "Canon", domains: ["lorebook", "codex"] },
  { label: "Research", domains: ["compendium"] },
  { label: "Review", domains: ["system", "chronicle"] },
];

/** How long the pointer rests on a row before its sections fan out, and leaves before they fold. */
const OPEN_MS = 120;
const CLOSE_MS = 220;

interface Fan {
  id: string;
  top: number;
  left: number;
}

/**
 * The story's pages, grouped (doc 24 D14). A page with sections (Lorebook, Promises,
 * Compendium, Chronicle) fans them out to the right: point at the row, press →, or press its
 * ›. The row itself still opens the page, so the menu stays one screen tall.
 */
export default function LogoMenuPages({
  storyId,
  pathname,
  counts,
  done,
}: {
  storyId: string;
  pathname: string;
  counts: Record<string, number>;
  done: () => void;
}) {
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const activeNode = useStoryStore((s) => s.activeNode);
  const routes = routesFor(mode).filter((r) => !r.ai || aiAvailable);
  const isHere = (r: StoryRoute) =>
    r.path === "" ? /^\/stories\/[^/]+\/?$/.test(pathname) : pathname.startsWith(storyPath(storyId, r));
  const openScene = activeNode?.story_id === storyId ? activeNode.title : undefined;

  const [fan, setFan] = useState<Fan | null>(null);
  const [focusFan, setFocusFan] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rows = useRef<Record<string, HTMLDivElement | null>>({});
  const fanEl = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const visible = (r: StoryRoute) =>
    (r.sections ?? []).filter((sec) => {
      const m = sectionModes(r, sec);
      return m.modes.includes(mode) && (!m.ai || aiAvailable);
    });
  const sectionOn = (r: StoryRoute, sec: RouteSection) => {
    const to = sectionPath(storyId, r.id, sec.id);
    return sec.path === "" ? pathname === to : pathname.startsWith(to);
  };

  function show(id: string) {
    const row = rows.current[id];
    const panel = row?.closest<HTMLElement>("[role=dialog]");
    if (!row || !panel) return;
    const r = row.getBoundingClientRect();
    setFan({ id, top: r.top - 6, left: panel.getBoundingClientRect().right + 4 });
  }
  function later(fn: () => void, ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }
  const hide = () => {
    setFan(null);
    setFocusFan(false);
  };

  // Opened from the keyboard: its first section takes the focus.
  useEffect(() => {
    if (fan && focusFan) fanEl.current?.querySelector<HTMLElement>("a")?.focus();
  }, [fan, focusFan]);

  const fanRoute = fan ? routes.find((r) => r.id === fan.id) : undefined;
  const fanSections = fanRoute ? visible(fanRoute) : [];

  function onFanKey(e: React.KeyboardEvent) {
    const items = [...(fanEl.current?.querySelectorAll<HTMLElement>("a") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      const back = fan && rows.current[fan.id]?.querySelector<HTMLElement>("a");
      hide();
      back?.focus();
    }
  }

  return (
    <nav aria-label="The story's pages">
      {GROUPS.map((g) => {
        const list = routes.filter((r) => g.domains.includes(r.domain));
        if (!list.length) return null;
        return (
          <div key={g.label} role="group" aria-labelledby={`logo-menu-${g.label}`}>
            <div className={styles.group} id={`logo-menu-${g.label}`}>
              {g.label}
            </div>
            {list.map((r) => {
              const Icon = r.icon;
              const here = isHere(r);
              const count = counts[r.id];
              const sections = visible(r);
              const fanned = fan?.id === r.id;
              const current = here ? sections.find((sec) => sec.path !== "" && sectionOn(r, sec)) : undefined;
              return (
                <div
                  key={r.id}
                  ref={(el) => {
                    rows.current[r.id] = el;
                  }}
                  className={`${styles.rowWrap} ${fanned ? styles.rowFanned : ""}`}
                  onMouseEnter={() =>
                    sections.length ? later(() => show(r.id), OPEN_MS) : later(hide, OPEN_MS)
                  }
                  onMouseLeave={() => later(hide, CLOSE_MS)}
                >
                  <Link
                    to={storyPath(storyId, r)}
                    onClick={done}
                    className={`${styles.row} ${here ? styles.rowOn : ""}`}
                    aria-current={here ? "page" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" && sections.length) {
                        e.preventDefault();
                        show(r.id);
                        setFocusFan(true);
                      }
                    }}
                  >
                    <Icon size={16} className={styles.rowIcon} aria-hidden />
                    <span className={styles.rowLabel}>{r.label}</span>
                    {count ? (
                      <span className={styles.count} aria-label={`${count} open`}>
                        {count}
                      </span>
                    ) : r.id === "write" && openScene ? (
                      <span className={styles.hint}>{openScene}</span>
                    ) : current ? (
                      <span className={styles.hint}>{current.label}</span>
                    ) : null}
                  </Link>
                  {sections.length > 0 && (
                    <button
                      type="button"
                      className={styles.fanBtn}
                      aria-label={`${r.label}: its sections`}
                      aria-expanded={fanned}
                      tabIndex={-1}
                      onClick={() => {
                        if (fanned) hide();
                        else {
                          show(r.id);
                          setFocusFan(true);
                        }
                      }}
                    >
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {fan && fanRoute && (
        <div
          ref={fanEl}
          data-fan
          className={styles.fan}
          style={{
            top: Math.max(8, Math.min(fan.top, window.innerHeight - fanSections.length * 34 - 24)),
            left: fan.left,
          }}
          role="group"
          aria-label={`${fanRoute.label}: its sections`}
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => later(hide, CLOSE_MS)}
          onKeyDown={onFanKey}
        >
          {fanSections.map((sec) => {
            const on = isHere(fanRoute) && sectionOn(fanRoute, sec);
            return (
              <Link
                key={sec.id}
                to={sectionPath(storyId, fanRoute.id, sec.id)}
                onClick={done}
                className={`${styles.fanItem} ${on ? styles.rowOn : ""}`}
                aria-current={on ? "page" : undefined}
              >
                {sec.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
