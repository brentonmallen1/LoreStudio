import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Compass, Monitor, Moon, Settings, Sun, type LucideIcon } from "lucide-react";
import LogoMark from "../common/LogoMark";
import { sectionPath } from "../../lib/routes";
import { setMode, useMode } from "../../lib/mode";
import { useOpenFindings } from "../../stores/findingsStore";
import { useOpenProposals } from "../../stores/proposalsStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAuthStore } from "../../stores/authStore";
import { THEME_META, useUIStore, type ColorMode } from "../../stores/uiStore";
import { toast } from "../../stores/toastStore";
import { useUpdateStore } from "../../stores/updateStore";
import { backupNeedsEye, useBackupStatus } from "../../hooks/useBackupStatus";
import { relativeTime } from "../../utils/relativeTime";
import LogoMenuPages from "./LogoMenuPages";
import styles from "./LogoMenu.module.css";

const COLOUR_MODES: { value: ColorMode; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Follow the system", Icon: Monitor },
];

/**
 * The logo, and the one place to go from (doc 24 D9, D14): the story's pages by domain, the
 * sections of a grouped page fanned out beside it, a count beside what is waiting on you, and a
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
  const loadUpdate = useUpdateStore((s) => s.load);
  // What the last check found, read once a visit (it never asks GitHub itself).
  useEffect(() => {
    if (open) void loadUpdate();
  }, [open, loadUpdate]);

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

  // A link chosen closes the menu, even one to the page already open.
  const done = () => setOpenAt(null);

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
    // A row's "beside the prose" button is reached with Tab; the arrows go on from its row.
    const current = document.activeElement as HTMLElement;
    const from = current.dataset.beside ? (current.parentElement?.querySelector("a") ?? current) : current;
    const at = items.indexOf(from);
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
            <Link to="/" className={styles.word} onClick={done}>
              All stories
            </Link>
          </div>
          {inStory && <LogoMenuPages storyId={storyId!} pathname={pathname} counts={counts} done={done} />}
          <Footer storyId={inStory ? storyId : undefined} backup={backup} done={done} />
        </div>
      )}
    </div>
  );
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  // The sections fanned out beside a row move by their own keys.
  return [...(root?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])].filter(
    (el) => !el.closest("[data-fan]") && el.tabIndex !== -1 && !el.dataset.beside,
  );
}

/** Guides, Settings, the colour mode, the backup, the mode and the account, in a tone box. */
function Footer({
  storyId,
  backup,
  done,
}: {
  storyId?: string;
  backup: ReturnType<typeof useBackupStatus>;
  done: () => void;
}) {
  const { colorMode, setColorMode, themeName } = useUIStore();
  const darkOnly = THEME_META[themeName].darkOnly;
  const mode = useMode();
  const [switching, setSwitching] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const update = useUpdateStore((s) => s.status);

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
      {update?.available && (
        <div className={styles.line}>
          <Link to="/settings#about" onClick={done} className={styles.word} title="How to update">
            <span className={`${styles.dot} ${styles.dotOk}`} aria-hidden />
            LoreStudio {update.latest} is available
          </Link>
        </div>
      )}
      <div className={styles.footRow}>
        <Link to="/guides" className={styles.footLink} onClick={done}>
          <Compass size={14} aria-hidden />
          Guides
        </Link>
        <Link to="/settings" className={styles.footLink} onClick={done}>
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
            onClick={done}
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
