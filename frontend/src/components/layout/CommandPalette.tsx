import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../api/client";
import {
  BookOpen,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Maximize2,
  MessageSquare,
} from "lucide-react";
import styles from "./CommandPalette.module.css";

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setTheme, toggleFocusMode, openInterview } = useUIStore();
  const { stories, characters } = useStoryStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const close = useCallback(() => setCommandPaletteOpen(false), [setCommandPaletteOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const storyActions = stories.map((s) => ({
    id: `story-${s.id}`,
    label: s.title,
    group: "Stories",
    Icon: BookOpen,
    action: () => navigate(`/stories/${s.id}`),
  }));

  const characterActions = characters.map((c) => [
    {
      id: `char-view-${c.id}`,
      label: `View: ${c.name}`,
      group: "Characters",
      Icon: Users,
      action: () => navigate(`/stories/${c.story_id}/characters/${c.id}`),
    },
    {
      id: `char-interview-${c.id}`,
      label: `Interview: ${c.name}`,
      group: "Characters",
      Icon: MessageSquare,
      action: async () => {
        const interview = await api.startInterview(c.id);
        openInterview(interview, c);
        close();
      },
    },
  ]).flat();

  const globalActions = [
    {
      id: "go-settings",
      label: "Settings",
      group: "Navigation",
      Icon: Settings,
      action: () => navigate("/settings"),
    },
    {
      id: "theme-light",
      label: "Set theme: Light",
      group: "Appearance",
      Icon: Sun,
      action: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Set theme: Dark",
      group: "Appearance",
      Icon: Moon,
      action: () => setTheme("dark"),
    },
    {
      id: "focus-mode",
      label: "Toggle focus mode",
      group: "View",
      Icon: Maximize2,
      action: toggleFocusMode,
    },
    {
      id: "logout",
      label: "Sign out",
      group: "Account",
      Icon: LogOut,
      action: logout,
    },
  ];

  const allActions = [...globalActions, ...storyActions, ...characterActions];

  const grouped = allActions.reduce(
    (acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, typeof allActions>
  );

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.paletteHeader}>
          <span className={styles.kbdHint}>⌘K</span>
          <span className={styles.paletteLabel}>Jump to…</span>
        </div>

        <div className={styles.list}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className={styles.group}>
              <p className={styles.groupLabel}>{group}</p>
              {items.map(({ id, label, Icon, action }) => (
                <button
                  key={id}
                  onClick={() => {
                    action();
                    close();
                  }}
                  className={styles.item}
                >
                  <Icon size={14} className={styles.itemIcon} />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}><kbd>↑↓</kbd> navigate</span>
          <span className={styles.footerHint}><kbd>↵</kbd> select</span>
          <span className={styles.footerHint}><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
