import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  PanelLeft,
  Maximize2,
  Feather,
  Database,
  PenLine,
  BookOpen,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useAIAvailable } from "../../lib/mode";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import UndoRedoButtons from "./UndoRedoButtons";
import { SHORTCUTS, formatCombo, isTypingTarget, matchesCombo } from "../../lib/keyboard/shortcuts";
import { useUIStore, THEME_META, FONT_OPTIONS, FONT_CATEGORIES } from "../../stores/uiStore";
import type {
  ThemeName,
  ColorMode,
  EditorFontFamily,
  EditorFontSize,
  EditorLineWidth,
} from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { hasScratchPadContent } from "../common/ScratchPadDrawer";
import { api } from "../../api/client";
import type { BackupStatus } from "../../types";
import styles from "./GlobalHeader.module.css";

const THEME_SWATCHES: Record<ThemeName, string[]> = {
  zen: ["#f7f6f3", "#4a7c59", "#8b6aa8"],
  "e-ink": ["#ede9de", "#4a7a58", "#7a5a98"],
  nord: ["#ECEFF4", "#5E81AC", "#BF616A"],
  solarized: ["#fdf6e3", "#2aa198", "#dc322f"],
  dracula: ["#282A36", "#50FA7B", "#BD93F9"],
  gruvbox: ["#fbf1c7", "#d65d0e", "#b16286"],
  catppuccin: ["#EFF1F5", "#8839EF", "#C6A0F6"],
};

const themeOptions: ThemeName[] = ["zen", "e-ink", "nord", "solarized", "dracula", "gruvbox", "catppuccin"];
const colorModeOptions: { value: ColorMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];
const sizeOptions: { value: EditorFontSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "xl", label: "XL" },
];
const widthOptions: { value: EditorLineWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const { user, logout } = useAuthStore();
  const aiAvailable = useAIAvailable();
  const undoRedo = useUndoRedo();
  const {
    themeName,
    colorMode,
    setThemeName,
    setColorMode,
    editorFontFamily,
    editorFontSize,
    editorLineWidth,
    setEditorFontFamily,
    setEditorFontSize,
    setEditorLineWidth,
    setCommandPaletteOpen,
    viewState,
    setViewState,
    toggleScratchPad,
    scratchPadOpen,
  } = useUIStore();
  const { panelOpen, togglePanel } = useAIStore();

  const isFocused = viewState === "focus";
  const [revealed, setRevealed] = useState(false);
  const [scratchHasContent, setScratchHasContent] = useState(false);

  // Refresh scratch pad indicator when drawer closes (content may have changed)
  useEffect(() => {
    if (!scratchPadOpen) {
      setScratchHasContent(hasScratchPadContent(storyId ?? null));
    }
  }, [scratchPadOpen, storyId]);

  // Backup status indicator — fetch on load and refresh every 60s
  // (keeps both the data and the relative-time text current)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  useEffect(() => {
    if (!storyId) {
      setBackupStatus(null);
      return;
    }
    api
      .getBackupStatus(storyId)
      .then(setBackupStatus)
      .catch(() => {});
    const interval = setInterval(() => {
      api
        .getBackupStatus(storyId)
        .then(setBackupStatus)
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [storyId]);

  // Cmd+/ to toggle assistant
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.assistant.combo)) {
        e.preventDefault();
        handleAssistantToggle();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isUndo = matchesCombo(e, SHORTCUTS.undo.combo);
      const isRedo = matchesCombo(e, SHORTCUTS.redo.combo);
      if (!isUndo && !isRedo) return;
      if (isTypingTarget(e)) return; // the editor and inputs keep their own history
      e.preventDefault();
      if (isRedo) undoRedo.redo();
      else undoRedo.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoRedo]);

  function handleAssistantToggle() {
    if (!aiAvailable) return;
    togglePanel();
  }
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // When returning to normal mode, immediately show header
  useEffect(() => {
    if (!isFocused) setRevealed(false);
  }, [isFocused]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function startHide() {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setRevealed(false);
      setSettingsOpen(false);
      setUserMenuOpen(false);
    }, 600);
  }

  function cancelHide() {
    clearTimeout(hideTimerRef.current);
  }

  const ColorModeIcon = colorMode === "dark" ? Moon : colorMode === "light" ? Sun : Monitor;

  return (
    <>
      {/* Hover zone — thin strip at top of screen that reveals header in focus mode */}
      {isFocused && !revealed && (
        <div
          className={styles.hoverZone}
          onMouseEnter={() => {
            cancelHide();
            setRevealed(true);
          }}
        />
      )}

      <header
        className={`${styles.header} ${isFocused && !revealed ? styles.headerHidden : ""}`}
        onMouseEnter={isFocused ? cancelHide : undefined}
        onMouseLeave={isFocused ? startHide : undefined}
      >
        <div className={styles.left}>
          {isFocused && (
            <button onClick={() => setViewState("normal")} className={styles.iconBtn} title="Restore sidebar">
              <PanelLeft size={15} />
            </button>
          )}
          <Link to="/" className={styles.wordmark}>
            LoreStudio
          </Link>
        </div>

        {/* Backup indicator — shown when inside a story */}
        {storyId && (
          <button
            className={`${styles.backupIndicator} ${
              backupStatus
                ? backupStatus.staleness === "fresh"
                  ? styles.backupFresh
                  : backupStatus.staleness === "stale"
                    ? styles.backupStale
                    : styles.backupOverdue
                : ""
            }`}
            onClick={() => navigate(`/stories/${storyId}/versions`)}
            title={
              backupStatus?.last_backup_at
                ? `Last backup: ${relativeTime(backupStatus.last_backup_at)} · Click to view version history`
                : "No backups yet · Click to view version history"
            }
          >
            <Database size={12} />
            {backupStatus?.last_backup_at ? (
              <span>{relativeTime(backupStatus.last_backup_at)}</span>
            ) : !backupStatus ? null : (
              <span>No backup</span>
            )}
            <span
              className={`${styles.backupDot} ${
                backupStatus
                  ? backupStatus.staleness === "fresh"
                    ? styles.dotFresh
                    : backupStatus.staleness === "stale"
                      ? styles.dotStale
                      : styles.dotOverdue
                  : styles.dotOverdue
              }`}
            />
          </button>
        )}

        <div className={styles.right}>
          <UndoRedoButtons undoRedo={undoRedo} />
          {/* AI Assistant — absent in Writer mode */}
          {aiAvailable && (
            <button
              onClick={handleAssistantToggle}
              className={`${styles.assistantBtn} ${panelOpen ? styles.assistantBtnActive : ""}`}
              title={`AI Assistant (${formatCombo(SHORTCUTS.assistant.combo)})`}
            >
              <Feather size={14} />
              <span>Assistant</span>
            </button>
          )}

          <button onClick={() => navigate("/guides")} className={styles.iconBtn} title="Guides">
            <BookOpen size={14} />
          </button>

          {/* Scratch Pad */}
          <button
            onClick={toggleScratchPad}
            className={`${styles.iconBtn} ${scratchPadOpen ? styles.iconBtnActive : ""}`}
            title={`Scratch pad (${formatCombo(SHORTCUTS.scratchPad.combo)})`}
            style={{ position: "relative" }}
          >
            <PenLine size={15} />
            {scratchHasContent && !scratchPadOpen && <span className={styles.scratchDot} />}
          </button>

          {/* Search */}
          <button onClick={() => setCommandPaletteOpen(true)} className={styles.searchBtn}>
            <Search size={14} />
            <span>Search</span>
            <kbd>{formatCombo(SHORTCUTS.palette.combo)}</kbd>
          </button>

          {/* Quick Settings */}
          <div className={styles.dropdownWrap} ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ""}`}
              title="Appearance settings"
              aria-label="Appearance settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
            >
              <Settings size={15} />
            </button>

            {settingsOpen && (
              <div className={styles.dropdown} role="menu">
                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Theme</span>
                  <div className={styles.themeGrid}>
                    {themeOptions.map((t) => (
                      <button
                        key={t}
                        onClick={() => setThemeName(t)}
                        className={`${styles.themeBtn} ${themeName === t ? styles.active : ""}`}
                        title={THEME_META[t].label}
                      >
                        <div className={styles.themeSwatch}>
                          {THEME_SWATCHES[t].map((color, i) => (
                            <span key={i} style={{ background: color }} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Color Mode</span>
                  <div className={styles.btnRow}>
                    {colorModeOptions.map(({ value, label, Icon }) => {
                      const isDisabled = value === "light" && THEME_META[themeName].darkOnly;
                      return (
                        <button
                          key={value}
                          onClick={() => !isDisabled && setColorMode(value)}
                          disabled={isDisabled}
                          className={`${styles.optionBtn} ${colorMode === value ? styles.active : ""}`}
                        >
                          <Icon size={12} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Editor Font</span>
                  <select
                    className={styles.fontSelect}
                    value={editorFontFamily}
                    onChange={(e) => setEditorFontFamily(e.target.value as EditorFontFamily)}
                    style={{ fontFamily: FONT_OPTIONS.find((f) => f.value === editorFontFamily)?.stack }}
                  >
                    {FONT_CATEGORIES.map(({ value: cat, label: catLabel }) => (
                      <optgroup key={cat} label={catLabel}>
                        {FONT_OPTIONS.filter((f) => f.category === cat).map(({ value, label, stack }) => (
                          <option key={value} value={value} style={{ fontFamily: stack }}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Font Size</span>
                  <div className={styles.btnRow}>
                    {sizeOptions.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setEditorFontSize(value)}
                        className={`${styles.optionBtn} ${editorFontSize === value ? styles.active : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Line Width</span>
                  <div className={styles.btnRow}>
                    {widthOptions.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setEditorLineWidth(value)}
                        className={`${styles.optionBtn} ${editorLineWidth === value ? styles.active : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate("/settings");
                  }}
                  className={styles.allSettingsBtn}
                >
                  All Settings
                </button>
              </div>
            )}
          </div>

          {/* Color Mode Quick Toggle */}
          <button
            onClick={() => {
              const next: Record<ColorMode, ColorMode> = { light: "dark", dark: "system", system: "light" };
              const nextMode = next[colorMode];
              if (!(nextMode === "light" && THEME_META[themeName].darkOnly)) {
                setColorMode(nextMode);
              } else {
                setColorMode("dark");
              }
            }}
            className={styles.iconBtn}
            title={`Color mode: ${colorMode}`}
          >
            <ColorModeIcon size={15} />
          </button>

          {/* Focus toggle: normal ↔ focus */}
          <button
            onClick={() => setViewState(isFocused ? "normal" : "focus")}
            className={`${styles.iconBtn} ${isFocused ? styles.iconBtnActive : ""}`}
            title={isFocused ? "Exit focus mode" : "Focus mode"}
          >
            <Maximize2 size={15} />
          </button>

          {/* User Menu */}
          <div className={styles.dropdownWrap} ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className={`${styles.userBtn} ${userMenuOpen ? styles.userBtnActive : ""}`}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className={styles.userAvatar}>
                {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "?"}
              </span>
              <ChevronDown size={12} />
            </button>

            {userMenuOpen && (
              <div className={styles.dropdown} role="menu">
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.display_name || user?.username}</span>
                  <span className={styles.userEmail}>{user?.username}</span>
                </div>
                <div className={styles.dropdownDivider} />
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className={styles.menuItem}
                  role="menuitem"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
