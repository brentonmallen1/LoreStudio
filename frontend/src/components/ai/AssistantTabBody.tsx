import { useEffect, useRef, useState } from "react";
import { Feather, Plus, ChevronLeft, User2, List } from "lucide-react";
import AIFeatureInfoTrigger from "./AIFeatureInfoTrigger";
import { useAIStore } from "../../stores/aiStore";
import { useStoryStore } from "../../stores/storyStore";
import { getSessionType, getAllSessionTypes } from "../../lib/ai/sessionTypes";
import SessionList from "./SessionList";
import { sessionLabel } from "../../lib/ai/sessionLabel";
import SessionView from "./SessionView";
import styles from "./AIPanel.module.css";

type MenuStep = { kind: "types" } | { kind: "pick-character"; forType: string };

/**
 * The assistant inside the side panel's Assistant tab (refactor doc 11, phase 5): the
 * open session, a way into the rest, a New menu, and the session itself. The frame,
 * floating and pop-out belong to the panel now, so this is only the conversation.
 */
export default function AssistantTabBody() {
  const { sessions, activeSessionId, createSession, renameSession } = useAIStore();
  const { activeStory, activeNode, characters } = useStoryStore();
  const [showSessions, setShowSessions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [menuStep, setMenuStep] = useState<MenuStep>({ kind: "types" });
  const [pickingCharacterFor, setPickingCharacterFor] = useState<string | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

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

  function launchSession(typeId: string, fromDropdown = false) {
    const type = getSessionType(typeId);
    if (!type) return;
    if (type.requiresCharacter) {
      if (fromDropdown) setMenuStep({ kind: "pick-character", forType: typeId });
      else setPickingCharacterFor(typeId);
      return;
    }
    createSession(typeId, type.getDefaultContext({ storyId: activeStory?.id, nodeId: activeNode?.id }));
    if (fromDropdown) {
      setShowNewMenu(false);
      setMenuStep({ kind: "types" });
    }
  }

  function handleCharacterPicked(characterId: string, forType: string) {
    const type = getSessionType(forType);
    if (!type) return;
    const context = type.getDefaultContext({ storyId: activeStory?.id, nodeId: activeNode?.id });
    createSession(forType, { ...context, characterId });
    setShowNewMenu(false);
    setMenuStep({ kind: "types" });
    setPickingCharacterFor(null);
  }

  const allTypes = getAllSessionTypes();
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <>
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

        <div className={styles.newMenuWrapper} ref={newMenuRef}>
          <button
            className={styles.newSessionBtn}
            onClick={() => {
              setMenuStep({ kind: "types" });
              setShowNewMenu((v) => !v);
            }}
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
              ) : (
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
              )}
            </div>
          )}
        </div>

        <div className={styles.tabControls}>
          <AIFeatureInfoTrigger pageId="ai-panel" size="sm" />
        </div>
      </div>

      {showSessions && <SessionList onPick={() => setShowSessions(false)} />}

      {activeSession ? (
        <SessionView session={activeSession} />
      ) : pickingCharacterFor ? (
        <div className={styles.charPicker}>
          <div className={styles.charPickerHeader}>
            <button
              aria-label="Back"
              className={styles.charPickerBack}
              onClick={() => setPickingCharacterFor(null)}
            >
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
    </>
  );
}
