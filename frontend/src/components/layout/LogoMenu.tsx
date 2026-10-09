import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Compass, Monitor, Moon, Settings, Sun, type LucideIcon } from "lucide-react";
import LogoMark from "../common/LogoMark";
import {
  routesFor,
  sectionModes,
  sectionPath,
  storyPath,
  type Domain,
  type StoryRoute,
} from "../../lib/routes";
import { setMode, useAIAvailable, useMode } from "../../lib/mode";
import { useOpenFindings } from "../../stores/findingsStore";
import { useOpenProposals } from "../../stores/proposalsStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAuthStore } from "../../stores/authStore";
import { THEME_META, useUIStore, type ColorMode } from "../../stores/uiStore";
import { toast } from "../../stores/toastStore";
import { backupNeedsEye, useBackupStatus } from "../../hooks/useBackupStatus";
import { relativeTime } from "../../utils/relativeTime";
import styles from "./LogoMenu.module.css";

/** The menu's groups, each a run of domains from `lib/routes.ts`, in the table's order. */
const GROUPS: { label: string; domains: Domain[] }[] = [
  { label: "Write", domains: ["home", "manuscript"] },
  { label: "Canon", domains: ["lorebook", "codex"] },
  { label: "Research", domains: ["compendium"] },
  { label: "Review", domains: ["system", "chronicle"] },
];

const COLOUR_MODES: { value: ColorMode; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Follow the system", Icon: Monitor },
];

/**
 * The logo, and the one place to go from (doc 24 D9, D14): the story's pages by domain with
 * their sections as quiet words under them, a count beside what is waiting on you, and a
 * footer with Guides, Settings, the colour mode, the backup, the mode and the account.
 * The badge on the logo is open findings plus pending proposals (D5); a warning dot only
 * when a backup is overdue (D7). Outside a story it holds the footer alone.
 */
export default function LogoMenu() {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  // Open at an address: a page chosen, or Back, and the menu has done its job.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const activeStory = useStoryStore((s) => s.activeStory);
  const inStory = !!storyId && activeStory?.id === storyId;

  const findings = useOpenFindings().length;
  const proposals = useOpenProposals().length;
  const counts: Record<string, number> = inStory ? { findings, proposals } : {};
  const waiting = inStory ? findings + proposals : 0;
  const backup = useBackupStatus(inStory ? storyId : undefined);
  const backupAlert = backupNeedsEye(backup);

  useEffect(() => {
    if (!open) return;
    const items = focusables(panel.current);
    (panel.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? items[0])?.focus();
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpenAt(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close() {
    setOpenAt(null);
    trigger.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key) || !panel.current?.contains(document.activeElement)) return;
    e.preventDefault();
    const items = focusables(panel.current);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  const label = [
    "Menu",
    waiting ? `${waiting} waiting on you` : "",
    backupAlert ? "the backup is overdue" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={styles.wrap} ref={wrap} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-label={label}
        title="Pages, settings and your account"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpenAt(pathname))}
      >
        <LogoMark size="1.867rem" />
        {waiting > 0 && <span className={styles.badge}>{waiting > 99 ? "99+" : waiting}</span>}
        {backupAlert && <span className={`${styles.alert} ${waiting > 0 ? styles.alertLow : ""}`} />}
      </button>
      {open && (
        <div ref={panel} className={styles.panel} role="dialog" aria-label="Menu">
          <div className={styles.head}>
            <span className={styles.storyName}>{inStory ? activeStory!.title : "LoreStudio"}</span>
            <Link to="/" className={styles.word}>
              All stories
            </Link>
          </div>
          {inStory && <Pages storyId={storyId!} pathname={pathname} counts={counts} />}
          <Footer storyId={inStory ? storyId : undefined} backup={backup} />
        </div>
      )}
    </div>
  );
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])];
}

/** The story's pages, grouped, with their sections as words under them. */
function Pages({
  storyId,
  pathname,
  counts,
}: {
  storyId: string;
  pathname: string;
  counts: Record<string, number>;
}) {
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const activeNode = useStoryStore((s) => s.activeNode);
  const routes = routesFor(mode).filter((r) => !r.ai || aiAvailable);
  const isHere = (r: StoryRoute) =>
    r.path === "" ? /^\/stories\/[^/]+\/?$/.test(pathname) : pathname.startsWith(storyPath(storyId, r));
  const openScene = activeNode?.story_id === storyId ? activeNode.title : undefined;

  return (
    <nav aria-label="The story's pages">
      {GROUPS.map((g) => {
        const rows = routes.filter((r) => g.domains.includes(r.domain));
        if (!rows.length) return null;
        return (
          <div key={g.label} role="group" aria-labelledby={`logo-menu-${g.label}`}>
            <div className={styles.group} id={`logo-menu-${g.label}`}>
              {g.label}
            </div>
            {rows.map((r) => {
              const Icon = r.icon;
              const here = isHere(r);
              const count = counts[r.id];
              const sections = (r.sections ?? []).filter((sec) => {
                const m = sectionModes(r, sec);
                return m.modes.includes(mode) && (!m.ai || aiAvailable);
              });
              return (
                <div key={r.id}>
                  <Link
                    to={storyPath(storyId, r)}
                    className={`${styles.row} ${here ? styles.rowOn : ""}`}
                    aria-current={here ? "page" : undefined}
                  >
                    <Icon size={16} className={styles.rowIcon} aria-hidden />
                    <span className={styles.rowLabel}>{r.label}</span>
                    {count ? (
                      <span className={styles.count} aria-label={`${count} open`}>
                        {count}
                      </span>
                    ) : r.id === "write" && openScene ? (
                      <span className={styles.hint}>{openScene}</span>
                    ) : null}
                  </Link>
                  {sections.length > 0 && (
                    <div className={styles.sections}>
                      {sections.map((sec) => {
                        const to = sectionPath(storyId, r.id, sec.id);
                        const on = sec.path === "" ? pathname === to : pathname.startsWith(to);
                        return (
                          <Link
                            key={sec.id}
                            to={to}
                            className={`${styles.word} ${on ? styles.wordOn : ""}`}
                            aria-current={on ? "page" : undefined}
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
    </nav>
  );
}

/** Guides, Settings, the colour mode, the backup, the mode and the account, in a tone box. */
function Footer({ storyId, backup }: { storyId?: string; backup: ReturnType<typeof useBackupStatus> }) {
  const { colorMode, setColorMode, themeName } = useUIStore();
  const darkOnly = THEME_META[themeName].darkOnly;
  const mode = useMode();
  const [switching, setSwitching] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function switchMode() {
    setSwitching(true);
    try {
      await setMode(mode === "writer" ? "studio" : "writer");
    } catch {
      toast.error("The mode did not change. Try again in a moment.");
    } finally {
      setSwitching(false);
    }
  }

  const backupTone = !backup?.last_backup_at
    ? styles.dotNone
    : backup.staleness === "fresh"
      ? styles.dotOk
      : backup.staleness === "stale"
        ? styles.dotStale
        : styles.dotOverdue;

  return (
    <div className={styles.foot}>
      <div className={styles.footRow}>
        <Link to="/guides" className={styles.footLink}>
          <Compass size={14} aria-hidden />
          Guides
        </Link>
        <Link to="/settings" className={styles.footLink}>
          <Settings size={14} aria-hidden />
          Settings
        </Link>
        <span className={styles.spacer} />
        <span className={styles.seg} role="group" aria-label="Colour mode">
          {COLOUR_MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className={`${styles.segBtn} ${colorMode === value ? styles.segOn : ""}`}
              aria-label={label}
              title={value === "light" && darkOnly ? `${THEME_META[themeName].label} is dark only` : label}
              aria-pressed={colorMode === value}
              disabled={value === "light" && darkOnly}
              onClick={() => setColorMode(value)}
            >
              <Icon size={14} aria-hidden />
            </button>
          ))}
        </span>
      </div>
      <div className={styles.line}>
        {storyId && backup ? (
          <Link
            to={sectionPath(storyId, "chronicle", "versions")}
            className={styles.word}
            title="Versions of this story"
          >
            <span className={`${styles.dot} ${backupTone}`} aria-hidden />
            {backup.last_backup_at ? `Backed up ${relativeTime(backup.last_backup_at)}` : "Not backed up yet"}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={styles.word}
          onClick={switchMode}
          disabled={switching}
          title={
            mode === "writer"
              ? "Writer mode: no AI anywhere. Switch to Studio mode"
              : "Studio mode: everything, the Assistant included. Switch to Writer mode"
          }
        >
          {mode === "writer" ? "Writer mode" : "Studio mode"}
        </button>
      </div>
      <div className={styles.line}>
        <span className={styles.who}>Signed in as {user?.display_name || user?.username || "you"}</span>
        <button type="button" className={styles.word} onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
