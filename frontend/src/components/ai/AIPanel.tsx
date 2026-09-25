import { useEffect, useRef, useState } from "react";
import {
  Minus,
  X,
  Feather,
  Plus,
  ChevronLeft,
  User2,
  PanelRight,
  PictureInPicture2,
  ExternalLink,
  List,
} from "lucide-react";
import AIFeatureInfoTrigger from "./AIFeatureInfoTrigger";
import { useAIStore } from "../../stores/aiStore";
import { useStoryStore } from "../../stores/storyStore";
import { getSessionType, getAllSessionTypes } from "../../lib/ai/sessionTypes";
import PanelFrame from "./PanelFrame";
import SessionList from "./SessionList";
import { sessionLabel } from "../../lib/ai/sessionLabel";
import { AI_WINDOW_PATH } from "../../lib/ai/panelChannel";
import SessionView from "./SessionView";
import styles from "./AIPanel.module.css";

type MenuStep = { kind: "types" } | { kind: "pick-character"; forType: string };

export default function AIPanel() {
  const {
    panelOpen,
    panelCollapsed,
    sessions,
    activeSessionId,
    closePanel,
    collapsePanel,
    expandPanel,
    createSession,
    panelFloating,
    togglePanelFloating,
    otherWindowOpen,
    renameSession,
  } = useAIStore();
  const [showSessions, setShowSessions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const inOwnWindow = typeof window !== "undefined" && window.location.pathname === AI_WINDOW_PATH;

  function openInNewWindow() {
    const story = activeStory?.id ? `?story=${encodeURIComponent(activeStory.id)}` : "";
    // A named window means a second click focuses the one that is open, not a third panel.
    const opened = window.open(`${AI_WINDOW_PATH}${story}`, "lorestudio-ai", "width=460,height=760");
    // Leave the strip saying where the panel went, with a way back. Closing the panel here
    // meant the strip — which only renders while the panel is open — could never appear,
    // and the panel simply vanished. The new window's hello confirms it; its goodbye clears it.
    if (opened) useAIStore.setState({ otherWindowOpen: true });
  }
  const { activeStory, activeNode, characters } = useStoryStore();

  // New session menu state
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [menuStep, setMenuStep] = useState<MenuStep>({ kind: "types" });
  const newMenuRef = useRef<HTMLDivElement>(null);

  // Character picker overlay (for session types that require a character, triggered from empty state)
  const [pickingCharacterFor, setPickingCharacterFor] = useState<string | null>(null);

  useEffect(() => {
    if (!showNewMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
        setMenuStep({ kind: "types" });
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNewMenu]);

  // Keep the content area clear of the panel. A docked panel's own width is set by
  // PanelFrame, which owns it; the cases here are the ones where nothing is docked.
  useEffect(() => {
    if (panelOpen && !panelCollapsed && !panelFloating) return;
    const offset = panelOpen && panelCollapsed ? 32 : 0;
    document.documentElement.style.setProperty("--ai-panel-offset", `${offset}px`);
  }, [panelOpen, panelCollapsed, panelFloating]);

  function launchSession(typeId: string, fromDropdown = false) {
    const type = getSessionType(typeId);
    if (!type) return;

    if (type.requiresCharacter) {
      if (fromDropdown) {
        setMenuStep({ kind: "pick-character", forType: typeId });
      } else {
        setPickingCharacterFor(typeId);
      }
      return;
    }

    const context = type.getDefaultContext({
      storyId: activeStory?.id,
      nodeId: activeNode?.id,
    });
    createSession(typeId, context);
    if (fromDropdown) {
      setShowNewMenu(false);
      setMenuStep({ kind: "types" });
    }
  }

  function handleCharacterPicked(characterId: string, forType: string) {
    const type = getSessionType(forType);
    if (!type) return;
    const context = type.getDefaultContext({
      storyId: activeStory?.id,
      nodeId: activeNode?.id,
    });
    createSession(forType, { ...context, characterId });
    setShowNewMenu(false);
    setMenuStep({ kind: "types" });
    setPickingCharacterFor(null);
  }

  function openNewMenu() {
    setMenuStep({ kind: "types" });
    setShowNewMenu((v) => !v);
  }

  const allTypes = getAllSessionTypes();

  if (!panelOpen) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // The panel is open in its own window: say so rather than showing a second copy of it.
  if (otherWindowOpen && !inOwnWindow) {
    return (
      <div className={styles.awayStrip} role="status">
        <ExternalLink size={12} />
        <span>AI panel is open in another window</span>
        <button className={styles.awayBtn} onClick={() => useAIStore.setState({ otherWindowOpen: false })}>
          Bring it back
        </button>
      </div>
    );
  }

  // Collapsed state: just a thin strip with a button to expand
  if (panelCollapsed) {
    return (
      <button
        className={styles.collapsed}
        onClick={expandPanel}
        aria-label={
          sessions.length > 0
            ? `Expand AI panel (${sessions.length} session${sessions.length !== 1 ? "s" : ""})`
            : "Expand AI panel"
        }
      >
        <Feather size={16} className={styles.collapsedIcon} />
        {sessions.length > 0 && (
          <span className={styles.collapsedCount} aria-hidden="true">
            {sessions.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <PanelFrame floating={panelFloating && !inOwnWindow} fill={inOwnWindow}>
      {/* Session bar: the open session, and a way into the rest (doc 06 §2.1) */}
      <div className={styles.tabBar}>
        <button
          className={styles.sessionsBtn}
          onClick={() => setShowSessions((v) => !v)}
          aria-expanded={showSessions}
          title="Open sessions"
        >
          <List size={12} />
          <span className={styles.sessionsCount}>{sessions.length}</span>
        </button>

        {renaming && activeSession ? (
          <input
            className={styles.titleInput}
            defaultValue={sessionLabel(activeSession)}
            autoFocus
            onBlur={(e) => {
              renameSession(activeSession.id, e.target.value);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            className={styles.currentTitle}
            onClick={() => activeSession && setRenaming(true)}
            title={activeSession ? "Rename this session" : "Assistant"}
            disabled={!activeSession}
          >
            {activeSession ? sessionLabel(activeSession) : "Assistant"}
          </button>
        )}

        {/* New session button — between tabs and controls */}
        <div className={styles.newMenuWrapper} ref={newMenuRef}>
          <button
            className={styles.newSessionBtn}
            onClick={openNewMenu}
            title="New session"
            aria-label="New session"
            aria-expanded={showNewMenu}
          >
            <Plus size={12} />
            <span>New</span>
          </button>
          {showNewMenu && (
            <div className={styles.newMenu}>
              {menuStep.kind === "types" ? (
                allTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      className={styles.newMenuItem}
                      onClick={() => launchSession(type.id, true)}
                    >
                      <Icon size={13} className={styles.newMenuItemIcon} />
                      <span>{type.label}</span>
                    </button>
                  );
                })
              ) : menuStep.kind === "pick-character" ? (
                <>
                  <button className={styles.newMenuBack} onClick={() => setMenuStep({ kind: "types" })}>
                    <ChevronLeft size={12} />
                    Back
                  </button>
                  <div className={styles.newMenuSectionLabel}>Select a character</div>
                  {characters.length === 0 ? (
                    <div className={styles.newMenuEmpty}>No characters in this story</div>
                  ) : (
                    characters.map((c) => (
                      <button
                        key={c.id}
                        className={styles.newMenuItem}
                        onClick={() => handleCharacterPicked(c.id, menuStep.forType)}
                      >
                        <User2 size={13} className={styles.newMenuItemIcon} />
                        <span>{c.name}</span>
                      </button>
                    ))
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className={styles.tabControls}>
          <AIFeatureInfoTrigger pageId="ai-panel" size="sm" />
          {!inOwnWindow && (
            <button
              className={styles.controlBtn}
              onClick={openInNewWindow}
              title="Open the panel in its own window"
              aria-label="Open the AI panel in its own window"
            >
              <ExternalLink size={13} />
            </button>
          )}
          <button
            className={styles.controlBtn}
            onClick={togglePanelFloating}
            title={panelFloating ? "Dock to the side" : "Float over the page"}
            aria-label={panelFloating ? "Dock the AI panel" : "Float the AI panel"}
          >
            {panelFloating ? <PanelRight size={13} /> : <PictureInPicture2 size={13} />}
          </button>
          <button className={styles.controlBtn} onClick={collapsePanel} title="Minimize">
            <Minus size={13} />
          </button>
          <button className={styles.controlBtn} onClick={closePanel} title="Close AI panel">
            <X size={13} />
          </button>
        </div>
      </div>

      {showSessions && <SessionList onPick={() => setShowSessions(false)} />}

      {/* Session content */}
      {activeSession ? (
        <SessionView session={activeSession} />
      ) : pickingCharacterFor ? (
        /* Character picker overlay — shown when Interview is launched from the empty state */
        <div className={styles.charPicker}>
          <div className={styles.charPickerHeader}>
            <button className={styles.charPickerBack} onClick={() => setPickingCharacterFor(null)}>
              <ChevronLeft size={13} />
            </button>
            <span className={styles.charPickerTitle}>Select a character</span>
          </div>
          {characters.length === 0 ? (
            <p className={styles.charPickerEmpty}>No characters in this story.</p>
          ) : (
            <div className={styles.charPickerList}>
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={styles.charPickerItem}
                  onClick={() => handleCharacterPicked(c.id, pickingCharacterFor)}
                >
                  <User2 size={14} className={styles.charPickerIcon} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.empty}>
          <Feather size={24} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>AI Assistant</p>
          <p className={styles.emptyHint}>Choose a tool to start a new session.</p>
          <div className={styles.emptyModes}>
            {allTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button key={type.id} className={styles.emptyModeBtn} onClick={() => launchSession(type.id)}>
                  <Icon size={13} className={styles.emptyModeIcon} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </PanelFrame>
  );
}
