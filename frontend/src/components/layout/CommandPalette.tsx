import { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import { api } from "../../api/client";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { commandRegistry } from "../../lib/commands/registry";
import { useEntityCommands } from "../../lib/commands/entities";
import type { CommandAction } from "../../lib/commands/registry";
import type { SearchResult } from "../../types";
import {
  BookOpen,
  Users,
  Clapperboard,
  MapPin,
  GitBranch,
  Loader2,
  Search,
  ChevronRight,
  RotateCcw,
  Scroll,
  UserPlus,
  Plus,
  BookMarked,
} from "lucide-react";
import { useStoryStore as _useStoryStoreForNav } from "../../stores/storyStore";
import styles from "./CommandPalette.module.css";

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
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const navigate = useNavigate();
  const { activeStory, setActiveNode } = useStoryStore();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Sub-menu: when a parent action has getSubItems, drill into it
  const [subMenu, setSubMenu] = useState<{ parent: CommandAction; items: CommandAction[] } | null>(null);
  const [subQuery, setSubQuery] = useState("");
  const [subSelectedIndex, setSubSelectedIndex] = useState(0);
  // Revision counter to re-evaluate registry on store changes
  const [, forceUpdate] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery("");
    setSearchResults([]);
    setSubMenu(null);
    setSubQuery("");
  }, [setCommandPaletteOpen]);

  // Stories, cast, places, threads and outline nodes follow the store (lib/commands/entities.ts).
  useEntityCommands();

  // Register creation commands whenever the active story changes
  useEffect(() => {
    const hasStory = () => !!_useStoryStoreForNav.getState().activeStory;
    // Page navigation ("Go to …") is generated from lib/routes.ts in lib/commands, with the
    // mode filter. A second, hand-written copy here used to overwrite those commands by id
    // and dropped the filter, so Writer mode offered What-If, Panels and Discoveries.

    // Creation commands
    commandRegistry.update({
      id: "create-character",
      label: "New Character",
      keywords: ["new", "create", "add", "character"],
      icon: UserPlus,
      group: "Create",
      when: hasStory,
      action: () => {
        const sid = _useStoryStoreForNav.getState().activeStory?.id;
        if (sid) navigate(`/stories/${sid}/lorebook/characters`);
      },
    });
    commandRegistry.update({
      id: "create-lorebook-entry",
      label: "Open Story Identity",
      keywords: ["story identity", "lorebook", "lore", "canon", "open"],
      icon: BookMarked,
      group: "Navigate",
      when: hasStory,
      action: () => {
        const sid = _useStoryStoreForNav.getState().activeStory?.id;
        if (sid) navigate(`/stories/${sid}/lorebook`);
      },
    });
    commandRegistry.update({
      id: "create-compendium-entry",
      label: "New Compendium Entry",
      keywords: ["new", "create", "add", "compendium", "research", "note"],
      icon: Scroll,
      group: "Create",
      when: hasStory,
      action: () => {
        const sid = _useStoryStoreForNav.getState().activeStory?.id;
        if (sid) navigate(`/stories/${sid}/compendium`);
      },
    });
    commandRegistry.update({
      id: "create-thread",
      label: "New Plot Thread",
      keywords: ["new", "create", "add", "thread", "plot", "subplot"],
      icon: GitBranch,
      group: "Create",
      when: hasStory,
      action: () => {
        const sid = _useStoryStoreForNav.getState().activeStory?.id;
        if (sid) navigate(`/stories/${sid}/lorebook/threads`);
      },
    });
    commandRegistry.update({
      id: "create-story",
      label: "New Story",
      keywords: ["new", "create", "add", "story"],
      icon: Plus,
      group: "Create",
      action: () => navigate("/"),
    });

    forceUpdate((n) => n + 1);
  }, [activeStory?.id, navigate]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.palette.combo)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, setCommandPaletteOpen]);

  // Focus the active input when palette/submenu opens
  useEffect(() => {
    if (commandPaletteOpen) {
      if (subMenu) {
        setTimeout(() => subInputRef.current?.focus(), 30);
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [commandPaletteOpen, subMenu]);

  // Debounced server search (only when not in sub-menu)
  useEffect(() => {
    if (subMenu) return;
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
        // Characters, places and threads of the open story are commands now (Open beside /
        // Go to page), so their content hits would only repeat the row above.
        const sid = useStoryStore.getState().activeStory?.id;
        setSearchResults(
          results.filter((r) => !(r.story_id === sid && ["character", "setting", "thread"].includes(r.type))),
        );
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
  }, [query, subMenu]);

  if (!commandPaletteOpen) return null;

  // ── Search results navigation ──────────────────────────────────────────────

  function navigateTo(result: SearchResult) {
    switch (result.type) {
      case "story":
        navigate(`/stories/${result.story_id}`);
        break;
      case "character":
        navigate(`/stories/${result.story_id}/lorebook/characters/${result.id}`);
        break;
      case "scene": {
        api.getNode(result.id).then(setActiveNode);
        navigate(`/stories/${result.story_id}/write`);
        break;
      }
      case "setting":
        navigate(`/stories/${result.story_id}/lorebook`);
        break;
      case "thread":
        navigate(`/stories/${result.story_id}/lorebook/threads/${result.id}`);
        break;
    }
    close();
  }

  // ── Action execution ───────────────────────────────────────────────────────

  /** The second way to run a command (doc 11 P4): ⌘Enter, or the pill on its row. */
  function executeSecondary(action: CommandAction) {
    if (!action.secondaryAction) return executeAction(action);
    commandRegistry.recordUsed(action.id);
    action.secondaryAction.run();
    close();
  }

  function executeAction(action: CommandAction) {
    if (action.getSubItems) {
      const items = action.getSubItems();
      setSubMenu({ parent: action, items });
      setSubQuery("");
      setSubSelectedIndex(0);
    } else {
      commandRegistry.recordUsed(action.id);
      action.action();
      close();
    }
  }

  function executeSubItem(action: CommandAction) {
    action.action();
    close();
  }

  // ── Visible items ──────────────────────────────────────────────────────────

  const hasQuery = query.trim().length > 0 && !subMenu;
  const hasSearchResults = searchResults.length > 0;

  // Group action results from registry (always shown)
  const actionGroups: Record<string, CommandAction[]> = commandRegistry.grouped(query);
  const hasActionResults = Object.values(actionGroups).some((g) => g.length > 0);

  // Last run — pinned at top only when no query (hidden while searching so top result is auto-selected)
  const lastRun: CommandAction | null = !subMenu && !hasQuery ? commandRegistry.getLastRun() : null;

  // Recent items — shown only when no query (and exclude the last-run item to avoid duplication)
  const recentItems: CommandAction[] =
    !query.trim() && !subMenu ? commandRegistry.getRecent().filter((a) => a.id !== lastRun?.id) : [];

  // Sub-menu filtering
  const filteredSubItems = subMenu
    ? subQuery.trim()
      ? subMenu.items.filter((item) => {
          const q = subQuery.toLowerCase();
          return (
            item.label.toLowerCase().includes(q) ||
            (item.keywords ?? []).some((k) => k.toLowerCase().includes(q))
          );
        })
      : subMenu.items
    : [];

  // Flat list for keyboard nav — last-run first (always), then recent (no query), then commands, then content results
  const flatItems: Array<{ action: () => void; secondary?: () => void }> = [
    ...(lastRun
      ? [{ action: () => executeAction(lastRun), secondary: () => executeSecondary(lastRun) }]
      : []),
    ...recentItems.map((a) => ({ action: () => executeAction(a), secondary: () => executeSecondary(a) })),
    ...Object.values(actionGroups).flatMap((items) =>
      items.map((a) => ({ action: () => executeAction(a), secondary: () => executeSecondary(a) })),
    ),
    ...(hasQuery && hasSearchResults ? searchResults.map((r) => ({ action: () => navigateTo(r) })) : []),
  ];

  const flatSubItems = filteredSubItems.map((a) => ({ action: () => executeSubItem(a) }));

  // ── Keyboard handling ──────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const n = Math.min(i + 1, flatItems.length - 1);
        scrollToIndex(n);
        return n;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const n = Math.max(i - 1, 0);
        scrollToIndex(n);
        return n;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      const secondary = item?.secondary;
      if (secondary && matchesCombo(e.nativeEvent, SHORTCUTS.submitText.combo)) secondary();
      else item?.action();
    }
  }

  function handleSubKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setSubMenu(null);
      setSubQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSubSelectedIndex((i) => Math.min(i + 1, flatSubItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSubSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatSubItems[subSelectedIndex]?.action();
    }
  }

  function scrollToIndex(index: number) {
    const list = listRef.current;
    if (!list) return;
    const buttons = list.querySelectorAll("button[data-item]");
    (buttons[index] as HTMLElement)?.scrollIntoView({ block: "nearest" });
  }

  // Group search results by type
  const groupedResults = searchResults.reduce(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );
  const resultTypeOrder: SearchResult["type"][] = ["story", "character", "scene", "setting", "thread"];

  return (
    <div className={styles.overlay} onClick={close} aria-hidden="true">
      <div
        className={styles.palette}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sub-menu view ── */}
        {subMenu ? (
          <>
            <div className={styles.searchRow}>
              <button
                className={styles.backBtn}
                onClick={() => {
                  setSubMenu(null);
                  setTimeout(() => inputRef.current?.focus(), 30);
                }}
                aria-label="Back to main menu"
              >
                <ChevronRight size={14} className={styles.backIcon} />
              </button>
              <span className={styles.subMenuContext} aria-hidden="true">
                {subMenu.parent.label}
              </span>
              <input
                ref={subInputRef}
                className={styles.searchInput}
                placeholder={`Filter ${subMenu.parent.label.toLowerCase()}…`}
                aria-label={`Filter ${subMenu.parent.label}`}
                value={subQuery}
                onChange={(e) => {
                  setSubQuery(e.target.value);
                  setSubSelectedIndex(0);
                }}
                onKeyDown={handleSubKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={styles.list} role="listbox" aria-label={subMenu.parent.label} ref={listRef}>
              {filteredSubItems.length === 0 && <p className={styles.empty}>No matches</p>}
              {filteredSubItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-item
                    role="option"
                    aria-selected={idx === subSelectedIndex}
                    onClick={() => executeSubItem(item)}
                    className={`${styles.item}${idx === subSelectedIndex ? ` ${styles.activeItem}` : ""}`}
                  >
                    <Icon size={14} className={styles.itemIcon} aria-hidden="true" />
                    <span className={styles.itemContent}>
                      <span className={styles.itemTitle}>{item.label}</span>
                      {item.description && <span className={styles.itemSubtitle}>{item.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.footer} aria-hidden="true">
              <span className={styles.footerHint}>
                <kbd>↑↓</kbd> navigate
              </span>
              <span className={styles.footerHint}>
                <kbd>↵</kbd> select
              </span>
              <span className={styles.footerHint}>
                <kbd>Esc</kbd> back
              </span>
            </div>
          </>
        ) : (
          <>
            {/* ── Main search view ── */}
            <div className={styles.searchRow}>
              <Search size={15} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder="Search or jump to…"
                aria-label="Search or jump to a command"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              {searching && <Loader2 size={14} className={styles.spinner} aria-hidden="true" />}
              <span className={styles.kbdHint} aria-hidden="true">
                {formatCombo(SHORTCUTS.palette.combo)}
              </span>
            </div>

            <div className={styles.list} role="listbox" aria-label="Commands" ref={listRef}>
              {/* ── Last Run (always pinned at top) ── */}
              {lastRun &&
                (() => {
                  const idx = 0;
                  const Icon = lastRun.icon;
                  return (
                    <div className={styles.lastRunGroup} role="group" aria-label="Last run">
                      <p className={styles.lastRunLabel} aria-hidden="true">
                        <RotateCcw size={10} aria-hidden="true" />
                        Last run
                      </p>
                      <button
                        data-item
                        role="option"
                        aria-selected={idx === selectedIndex}
                        onClick={() => executeAction(lastRun)}
                        className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                        title={lastRun.shortcut ? `${lastRun.label} (${lastRun.shortcut})` : lastRun.label}
                      >
                        <Icon size={14} className={styles.itemIcon} aria-hidden="true" />
                        <span className={styles.itemContent}>
                          <span className={styles.itemTitle}>{lastRun.label}</span>
                          {lastRun.description && (
                            <span className={styles.itemSubtitle}>{lastRun.description}</span>
                          )}
                        </span>
                        {lastRun.shortcut && (
                          <span className={styles.shortcutHint} aria-hidden="true">
                            {lastRun.shortcut}
                          </span>
                        )}
                        {lastRun.getSubItems && (
                          <ChevronRight size={12} className={styles.chevron} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  );
                })()}

              {/* ── Recent items (only when no query) ── */}
              {recentItems.length > 0 && (
                <div className={styles.group} role="group" aria-label="Recent">
                  <p className={styles.groupLabel} aria-hidden="true">
                    Recent
                  </p>
                  {recentItems.map((action, i) => {
                    const idx = (lastRun ? 1 : 0) + i;
                    const Icon = action.icon;
                    return (
                      <button
                        key={`recent-${action.id}`}
                        data-item
                        role="option"
                        aria-selected={idx === selectedIndex}
                        onClick={() => executeAction(action)}
                        className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                      >
                        <Icon size={14} className={styles.itemIcon} aria-hidden="true" />
                        <span className={styles.itemContent}>
                          <span className={styles.itemTitle}>{action.label}</span>
                          {action.description && (
                            <span className={styles.itemSubtitle}>{action.description}</span>
                          )}
                        </span>
                        {action.getSubItems && (
                          <ChevronRight size={12} className={styles.chevron} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                  <div className={styles.groupDivider} aria-hidden="true" />
                </div>
              )}

              {/* ── Command registry results (always shown) ── */}
              {(() => {
                let flatIdx = (lastRun ? 1 : 0) + recentItems.length;
                return Object.entries(actionGroups).map(([group, items]) => (
                  <div key={group} className={styles.group} role="group" aria-label={group}>
                    <p className={styles.groupLabel} aria-hidden="true">
                      {group}
                    </p>
                    {items.map((action) => {
                      const idx = flatIdx++;
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          data-item
                          role="option"
                          aria-selected={idx === selectedIndex}
                          onClick={() => executeAction(action)}
                          className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                          title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                        >
                          <Icon size={14} className={styles.itemIcon} aria-hidden="true" />
                          <span className={styles.itemContent}>
                            <span className={styles.itemTitle}>{action.label}</span>
                            {action.description && (
                              <span className={styles.itemSubtitle}>{action.description}</span>
                            )}
                          </span>
                          {action.shortcut && (
                            <span className={styles.shortcutHint} aria-hidden="true">
                              {action.shortcut}
                            </span>
                          )}
                          {action.secondaryAction && (
                            <span
                              role="button"
                              className={styles.pill}
                              title={`${action.secondaryAction.label} (${formatCombo(SHORTCUTS.submitText.combo)})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                executeSecondary(action);
                              }}
                            >
                              {action.secondaryAction.label}
                            </span>
                          )}
                          {action.getSubItems && (
                            <ChevronRight size={12} className={styles.chevron} aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}

              {/* ── Content search results (only when query typed) ── */}
              {hasQuery &&
                (hasSearchResults ? (
                  (() => {
                    let flatIdx =
                      (lastRun ? 1 : 0) +
                      recentItems.length +
                      Object.values(actionGroups).reduce((n, g) => n + g.length, 0);
                    return resultTypeOrder.map((type) => {
                      const items = groupedResults[type];
                      if (!items?.length) return null;
                      const Icon = TYPE_ICONS[type];
                      return (
                        <div key={type} className={styles.group} role="group" aria-label={TYPE_LABELS[type]}>
                          <p className={styles.groupLabel} aria-hidden="true">
                            {TYPE_LABELS[type]}
                          </p>
                          {items.map((result) => {
                            const idx = flatIdx++;
                            return (
                              <button
                                key={result.id}
                                data-item
                                role="option"
                                aria-selected={idx === selectedIndex}
                                onClick={() => navigateTo(result)}
                                className={`${styles.item}${idx === selectedIndex ? ` ${styles.activeItem}` : ""}`}
                              >
                                <Icon size={14} className={styles.itemIcon} aria-hidden="true" />
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
                ) : !searching && !hasActionResults ? (
                  <p className={styles.empty}>No results for &ldquo;{query}&rdquo;</p>
                ) : null)}
            </div>

            <div className={styles.footer} aria-hidden="true">
              <span className={styles.footerHint}>
                <kbd>↑↓</kbd> navigate
              </span>
              <span className={styles.footerHint}>
                <kbd>↵</kbd> select
              </span>
              <span className={styles.footerHint}>
                <kbd>Esc</kbd> close
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
