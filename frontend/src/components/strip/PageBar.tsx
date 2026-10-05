import { useEffect, useRef, useState } from "react";
import { useOpenFindings } from "../../stores/findingsStore";
import { useOpenProposals } from "../../stores/proposalsStore";
import { Link, useLocation, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useMode } from "../../lib/mode";
import { useAIAvailable } from "../../lib/mode";
import { routesFor, sectionModes, sectionPath, storyPath, type Domain } from "../../lib/routes";
import styles from "./Strip.module.css";

/** The pages the bar shows one click away; every page and its sections are under More. */
const BAR: string[] = ["plan", "lorebook", "promises", "compendium", "numbers", "findings"];

/** Groups of the More menu, divided by a rule: home and plan, canon, research, AI, history, the rest. */
const DOMAIN_ORDER: Domain[][] = [
  ["home", "manuscript"],
  ["lorebook"],
  ["compendium"],
  ["codex"],
  ["chronicle"],
  ["system"],
];

/**
 * The story's pages at the foot of the strip: the ones most often visited as icons, the one
 * you are on marked, and More with every page and its sections. What opens beside the page
 * (characters, places, notes, the Assistant) is on the panel's rail at the right edge.
 */
export default function PageBar({ wide }: { wide: boolean }) {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const openFindings = useOpenFindings().length;
  const openProposals = useOpenProposals().length;
  const badges: Record<string, number | undefined> = {
    findings: openFindings || undefined,
    proposals: openProposals || undefined,
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const routes = routesFor(mode).filter((r) => r.id !== "write" && (!r.ai || aiAvailable));
  const bar = BAR.flatMap((id) => routes.filter((r) => r.id === id));
  // More's count is what the bar does not already show.
  const moreBadge = Object.entries(badges).reduce<number>(
    (n, [id, b]) => n + (BAR.includes(id) ? 0 : (b ?? 0)),
    0,
  );
  const here = (path: string) => pathname.startsWith(path);

  return (
    <>
      {bar.map((r) => {
        const Icon = r.icon;
        const to = storyPath(storyId!, r);
        return (
          <Link
            key={r.id}
            to={to}
            className={`${styles.toolBtn} ${here(to) ? styles.toolBtnOn : ""}`}
            title={r.label}
            aria-label={r.label}
            aria-current={here(to) ? "page" : undefined}
          >
            <Icon size={16} />
            {badges[r.id] && <span className={styles.badge}>{badges[r.id]}</span>}
          </Link>
        );
      })}
      <div ref={ref} style={{ position: "relative" }}>
        <button
          className={styles.toolBtn}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-label="Every page"
          title="Every page"
        >
          <MoreHorizontal size={16} />
          {moreBadge > 0 && <span className={styles.badge}>{moreBadge}</span>}
        </button>
        {moreOpen && (
          <div
            className={styles.menu}
            role="menu"
            aria-label="Every page"
            style={{ bottom: wide ? 0 : 8, maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}
          >
            {DOMAIN_ORDER.map((domains, gi) => {
              const rows = routes.filter((r) => domains.includes(r.domain));
              if (!rows.length) return null;
              return (
                <div key={domains.join()} className={gi > 0 ? styles.menuGroup : undefined}>
                  {rows.map((r) => {
                    const Icon = r.icon;
                    const on = r.path !== "" && pathname.startsWith(storyPath(storyId!, r));
                    const sections = (r.sections ?? []).filter((sec) => {
                      const m = sectionModes(r, sec);
                      return m.modes.includes(mode) && (!m.ai || aiAvailable);
                    });
                    return (
                      <div key={r.id}>
                        <Link
                          role="menuitem"
                          to={storyPath(storyId!, r)}
                          className={`${styles.menuItem} ${on ? styles.menuItemOn : ""}`}
                          style={{ minHeight: 34 }}
                          onClick={() => setMoreOpen(false)}
                        >
                          <Icon size={14} />
                          <span className={styles.menuLabel}>{r.label}</span>
                          {badges[r.id] && <span className={styles.badge}>{badges[r.id]}</span>}
                        </Link>
                        {sections.length > 0 && (
                          <div className={styles.menuSections}>
                            {sections.map((sec) => {
                              const to = sectionPath(storyId!, r.id, sec.id);
                              return (
                                <Link
                                  key={sec.id}
                                  role="menuitem"
                                  to={to}
                                  className={`${styles.menuSection} ${(sec.path === "" ? pathname === to : pathname.startsWith(to)) ? styles.menuSectionOn : ""}`}
                                  onClick={() => setMoreOpen(false)}
                                >
                                  {sec.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
