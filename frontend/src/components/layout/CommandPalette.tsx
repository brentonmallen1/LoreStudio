import { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../api/client";
import type { SearchResult } from "../../types";
import {
  BookOpen,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Maximize2,
  MessageSquare,
  Search,
  Clapperboard,
  MapPin,
  GitBranch,
  Loader2,
  Images,
  Network,
  Palette,
} from "lucide-react";
import styles from "./CommandPalette.module.css";

function findNode(nodes: import("../../types").StructureNode[], id: string): import("../../types").StructureNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

const TYPE_ICONS: Record<SearchResult["type"], React.ElementType> = {
  story: BookOpen,
  character: Users,
  scene: Clapperboard,
  setting: MapPin,
  thread: GitBranch,
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  story: "Stories",
  character: "Characters",
  scene: "Scenes",
  setting: "Settings",
  thread: "Threads",
};

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setColorMode, setThemeName, setViewState, openInterview } = useUIStore();
  const { stories, characters, activeStory, structure, setActiveNode } = useStoryStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery("");
    setSearchResults([]);
  }, [setCommandPaletteOpen]);

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

  // Focus input when palette opens
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      setSelectedIndex(0);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.search(query.trim());
        setSearchResults(results);
        setSelectedIndex(0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!commandPaletteOpen) return null;

  function navigateTo(result: SearchResult) {
    switch (result.type) {
      case "story":
        navigate(`/stories/${result.story_id}`);
        break;
      case "character":
        navigate(`/stories/${result.story_id}/characters/${result.id}`);
        break;
      case "scene": {
        const node = findNode(structure, result.id);
        if (node) setActiveNode(node);
        navigate(`/stories/${result.story_id}`);
        break;
      }
      case "setting":
        navigate(`/stories/${result.story_id}/lorebook`);
        break;
      case "thread":
        navigate(`/stories/${result.story_id}/threads`);
        break;
    }
    close();
  }

  // Group search results by type
  const groupedResults = searchResults.reduce(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );
  const resultTypeOrder: SearchResult["type"][] = ["story", "character", "scene", "setting", "thread"];

  // Static jump-to actions (shown when no query)
  const storyActions = stories.flatMap((s) => [
    {
      id: `story-${s.id}`,
      label: s.title,
      group: "Stories",
      Icon: BookOpen,
      action: () => navigate(`/stories/${s.id}`),
    },
    {
      id: `story-media-${s.id}`,
      label: `Media & Diagrams: ${s.title}`,
      group: "Stories",
      Icon: Images,
      action: () => navigate(`/stories/${s.id}/media`),
    },
  ]);

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
      label: "Color mode: Light",
      group: "Appearance",
      Icon: Sun,
      action: () => setColorMode("light"),
    },
    {
      id: "theme-dark",
      label: "Color mode: Dark",
      group: "Appearance",
      Icon: Moon,
      action: () => setColorMode("dark"),
    },
    {
      id: "theme-zen",
      label: "Theme: Zen",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("zen"),
    },
    {
      id: "theme-e-ink",
      label: "Theme: E-ink",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("e-ink"),
    },
    {
      id: "theme-nord",
      label: "Theme: Nord",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("nord"),
    },
    {
      id: "theme-solarized",
      label: "Theme: Solarized",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("solarized"),
    },
    {
      id: "theme-dracula",
      label: "Theme: Dracula",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("dracula"),
    },
    {
      id: "theme-gruvbox",
      label: "Theme: Gruvbox",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("gruvbox"),
    },
    {
      id: "theme-catppuccin",
      label: "Theme: Catppuccin",
      group: "Appearance",
      Icon: Palette,
      action: () => setThemeName("catppuccin"),
    },
    {
      id: "focus-mode",
      label: "Toggle focus mode",
      group: "View",
      Icon: Maximize2,
      action: () => setViewState("focus"),
    },
    ...(activeStory ? [
      {
        id: "new-diagram",
        label: `New diagram: ${activeStory.title}`,
        group: "Media & Diagrams",
        Icon: Network,
        action: async () => {
          const title = prompt("Diagram title:");
          if (!title) return;
          await api.createDiagram(activeStory.id, { title });
          navigate(`/stories/${activeStory.id}/media`);
        },
      },
      {
        id: "open-media",
        label: `Open media library: ${activeStory.title}`,
        group: "Media & Diagrams",
        Icon: Images,
        action: () => navigate(`/stories/${activeStory.id}/media`),
      },
    ] : []),
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

  const isSearching = query.trim().length > 0;
  const hasResults = searchResults.length > 0;

  // Flat ordered list of selectable items for keyboard navigation.
  // Must match the exact render order so selectedIndex aligns with the highlighted button.
  const flatItems: Array<{ action: () => void }> = isSearching
    ? resultTypeOrder.flatMap((type) =>
        (groupedResults[type] ?? []).map((r) => ({ action: () => navigateTo(r) }))
      )
    : Object.values(grouped).flatMap((items) =>
        items.map((a) => ({ action: () => { a.action(); close(); } }))
      );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(i + 1, flatItems.length - 1);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.max(i - 1, 0);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[selectedIndex]?.action();
    }
  }

  function scrollToIndex(index: number) {
    const list = listRef.current;
    if (!list) return;
    const buttons = list.querySelectorAll("button");
    buttons[index]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div className={styles.searchRow}>
          <Search size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search or jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {searching && <Loader2 size={14} className={styles.spinner} />}
          <span className={styles.kbdHint}>⌘K</span>
        </div>

        <div className={styles.list} ref={listRef}>
          {isSearching ? (
            hasResults ? (
              (() => {
                let flatIdx = 0;
                return resultTypeOrder.map((type) => {
                  const items = groupedResults[type];
                  if (!items?.length) return null;
                  const Icon = TYPE_ICONS[type];
                  return (
                    <div key={type} className={styles.group}>
                      <p className={styles.groupLabel}>{TYPE_LABELS[type]}</p>
                      {items.map((result) => {
                        const idx = flatIdx++;
                        return (
                          <button
                            key={result.id}
                            onClick={() => navigateTo(result)}
                            className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                          >
                            <Icon size={14} className={styles.itemIcon} />
                            <span className={styles.itemContent}>
                              <span className={styles.itemTitle}>{result.title}</span>
                              {result.subtitle && (
                                <span className={styles.itemSubtitle}>{result.subtitle}</span>
                              )}
                              {result.excerpt && (
                                <span className={styles.itemExcerpt}>{result.excerpt}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                });
              })()
            ) : !searching ? (
              <p className={styles.empty}>No results for &ldquo;{query}&rdquo;</p>
            ) : null
          ) : (
            (() => {
              let flatIdx = 0;
              return Object.entries(grouped).map(([group, items]) => (
                <div key={group} className={styles.group}>
                  <p className={styles.groupLabel}>{group}</p>
                  {items.map(({ id, label, Icon, action }) => {
                    const idx = flatIdx++;
                    return (
                      <button
                        key={id}
                        onClick={() => { action(); close(); }}
                        className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                      >
                        <Icon size={14} className={styles.itemIcon} />
                        <span className={styles.itemContent}>
                          <span className={styles.itemTitle}>{label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ));
            })()
          )}
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
