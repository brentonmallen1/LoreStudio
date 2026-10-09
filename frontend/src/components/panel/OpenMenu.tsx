import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { isModClick, modClickLabel } from "../../lib/keyboard/shortcuts";
import { filterGroups, type OpenChoice, type OpenGroup } from "../../lib/panel/openChoices";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { CompendiumEntrySummary, Twist } from "../../types";
import { TOOLS, TOOL_LABELS, type EntityKind } from "../../types/panel";
import { useAIAvailable, useMode } from "../../lib/mode";
import { besideRoutes } from "../../lib/panel/pages";
import { findRoute } from "../../lib/routes";
import { entityColor } from "./entityColor";
import { TOOL_ICONS } from "./toolIcons";
import styles from "./OpenMenu.module.css";

/**
 * + Open… after the side panel's tabs: anything that can sit beside the page, found by name.
 * Characters, places, threads, twists, Compendium entries and pages open as their own tab; the
 * lists and tools show from the rail, as their buttons there do. ⌘-click (Ctrl elsewhere), or
 * the same key with Enter, opens one behind and keeps the menu open, so several can be opened.
 */
export default function OpenMenu() {
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const { characters, locations, threads } = useStoryStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const openTool = usePanelStore((s) => s.openTool);
  const openPage = usePanelStore((s) => s.openPage);
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [twists, setTwists] = useState<Twist[]>([]);
  const [entries, setEntries] = useState<CompendiumEntrySummary[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Twists and the Compendium are not in the story store: read them each time the menu opens.
  useEffect(() => {
    if (!open || !storyId) return;
    api
      .listTwists(storyId)
      .then(setTwists)
      .catch(() => setTwists([]));
    api
      .listCompendiumEntries(storyId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [open, storyId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const groups = useMemo<OpenGroup[]>(() => {
    const entity = (kind: EntityKind, id: string, label: string, meta?: string): OpenChoice => ({
      type: "entity",
      kind,
      id,
      label,
      meta,
    });
    return filterGroups(
      [
        {
          name: "Characters",
          choices: characters.map((c) => entity("character", c.id, c.name)),
        },
        {
          name: "Places",
          choices: locations.map((l) => entity("location", l.id, l.name)),
        },
        {
          name: "Threads",
          choices: threads.map((t) => entity("thread", t.id, t.name)),
        },
        {
          name: "Twists",
          choices: twists.map((t) => entity("twist", t.id, t.name)),
        },
        {
          name: "Compendium",
          choices: entries.map((e) => entity("compendium", e.id, e.title, e.entry_type)),
        },
        {
          name: "Pages beside the prose",
          choices: besideRoutes(mode, aiAvailable).map((r) => ({
            type: "page" as const,
            routeId: r.id,
            label: r.label,
          })),
        },
        {
          name: "Lists and tools",
          choices: TOOLS.map((tool) => ({ type: "tool" as const, tool, label: TOOL_LABELS[tool] })),
        },
      ],
      query,
    );
  }, [characters, locations, threads, twists, entries, query, mode, aiAvailable]);
  const flat = groups.flatMap((g) => g.choices);

  function show() {
    setQuery("");
    setActive(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    button.current?.focus();
  }
  /** Open a choice; behind keeps the page's tab where it is and the menu open. */
  function choose(c: OpenChoice, behind: boolean) {
    if (c.type === "tool") openTool(c.tool);
    else if (c.type === "page") openPage(c.routeId);
    else openEntity(c.kind, c.id, c.label, behind);
    if (!behind || c.type !== "entity") close();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % Math.max(1, flat.length);
      setActive(next);
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      choose(flat[active], e.metaKey || e.ctrlKey);
    }
  }

  // Where each group starts in the one run of choices the arrow keys move through.
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.choices.length, 0));
  return (
    <div ref={wrap} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={styles.plus}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open beside the page…"
        title="Open beside the page…"
        onClick={() => (open ? close() : show())}
      >
        <Plus size={14} aria-hidden />
      </button>
      {open && (
        <div className={styles.menu} role="dialog" aria-label="Open beside the page" onKeyDown={onKeyDown}>
          <input
            autoFocus
            className={styles.search}
            value={query}
            placeholder="Find a character, place, thread, twist…"
            aria-label="Find"
            aria-controls="panel-open-list"
            aria-activedescendant={flat[active] ? `panel-open-${active}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <div ref={list} id="panel-open-list" className={styles.list} role="listbox" aria-label="Choices">
            {groups.length === 0 && <p className={styles.none}>Nothing by that name.</p>}
            {groups.map((g, gi) => (
              <div key={g.name} role="group" aria-label={g.name}>
                <div className={styles.group}>{g.name}</div>
                {g.choices.map((c, ci) => {
                  const i = starts[gi] + ci;
                  const Icon =
                    c.type === "tool"
                      ? TOOL_ICONS[c.tool]
                      : c.type === "page"
                        ? (findRoute(c.routeId)?.icon ?? null)
                        : null;
                  return (
                    <div
                      key={
                        c.type === "tool"
                          ? c.tool
                          : c.type === "page"
                            ? `page:${c.routeId}`
                            : `${c.kind}:${c.id}`
                      }
                      id={`panel-open-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      className={styles.choice}
                      onMouseMove={() => setActive(i)}
                      onClick={(e) => choose(c, isModClick(e))}
                      title={c.type === "entity" ? `${modClickLabel()} to open it behind` : undefined}
                    >
                      {Icon ? (
                        <Icon size={13} className={styles.icon} aria-hidden />
                      ) : (
                        c.type === "entity" && (
                          <span className={styles.dot} style={{ background: entityColor(c.kind, c.id) }} />
                        )
                      )}
                      <span className={styles.label}>{c.label}</span>
                      {c.meta && <span className={styles.meta}>{c.meta}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className={styles.hint}>Enter opens it · {modClickLabel()} opens it behind</p>
        </div>
      )}
    </div>
  );
}
