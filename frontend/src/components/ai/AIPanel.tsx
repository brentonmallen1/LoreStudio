import { useEffect, useRef, useState } from "react";
import { Minus, X, MessageSquare, Feather, Pin, PinOff } from "lucide-react";
import { useAIStore } from "../../stores/aiStore";
import { useStoryStore } from "../../stores/storyStore";
import { getSessionType } from "../../lib/ai/sessionTypes";
import SessionView from "./SessionView";
import styles from "./AIPanel.module.css";

export default function AIPanel() {
  const [panelWidth, setPanelWidth] = useState(340);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(340);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const dx = resizeStartX.current - e.clientX;
      setPanelWidth(Math.max(280, Math.min(600, resizeStartWidth.current + dx)));
    }
    function onMouseUp() {
      if (isResizing.current) {
        document.documentElement.removeAttribute("data-ai-resizing");
      }
      isResizing.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function startResize(e: React.MouseEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
    document.documentElement.setAttribute("data-ai-resizing", "");
    e.preventDefault();
  }

  const {
    panelOpen,
    panelCollapsed,
    panelPinned,
    sessions,
    activeSessionId,
    closePanel,
    collapsePanel,
    expandPanel,
    closeSession,
    setActiveSession,
    setPanelPinned,
    createSession,
  } = useAIStore();
  const { activeStory, activeNode } = useStoryStore();

  // Keep content area from being obscured by the fixed panel
  useEffect(() => {
    const offset = !panelOpen ? 0 : panelCollapsed ? 32 : panelWidth;
    document.documentElement.style.setProperty("--ai-panel-offset", `${offset}px`);
    return () => { document.documentElement.style.setProperty("--ai-panel-offset", "0px"); };
  }, [panelOpen, panelCollapsed, panelWidth]);

  if (!panelOpen) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Collapsed state: just a thin strip with a button to expand
  if (panelCollapsed) {
    return (
      <button
        className={styles.collapsed}
        onClick={expandPanel}
        aria-label={sessions.length > 0 ? `Expand AI panel (${sessions.length} session${sessions.length !== 1 ? "s" : ""})` : "Expand AI panel"}
      >
        <Feather size={16} className={styles.collapsedIcon} />
        {sessions.length > 0 && (
          <span className={styles.collapsedCount} aria-hidden="true">{sessions.length}</span>
        )}
      </button>
    );
  }

  return (
    <aside className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs} role="tablist" aria-label="AI sessions">
          {sessions.map((session) => {
            const type = getSessionType(session.type);
            const Icon = type?.icon ?? MessageSquare;
            const label = type?.contextTitle(session.context, session.resolvedNames) ?? session.type;
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                role="tab"
                aria-selected={isActive}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              >
                <button
                  className={styles.tabMain}
                  onClick={() => setActiveSession(session.id)}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={12} className={styles.tabIcon} />
                  <span className={styles.tabLabel}>{label}</span>
                </button>
                <button
                  className={styles.tabClose}
                  onClick={() => closeSession(session.id)}
                  aria-label={`Close ${label}`}
                  title="Close tab"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <span className={styles.tabEmpty}>Assistant</span>
          )}
        </div>
        <div className={styles.tabControls}>
          <button
            className={`${styles.controlBtn} ${panelPinned ? styles.controlBtnActive : ""}`}
            onClick={() => setPanelPinned(!panelPinned)}
            title={panelPinned ? "Unpin panel (will close when empty)" : "Pin panel (keep open)"}
          >
            {panelPinned ? <Pin size={12} /> : <PinOff size={12} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={collapsePanel}
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            className={styles.controlBtn}
            onClick={closePanel}
            title="Close AI panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Session content */}
      {activeSession ? (
        <SessionView session={activeSession} />
      ) : (
        <div className={styles.empty}>
          <Feather size={24} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>AI Assistant</p>
          <p className={styles.emptyHint}>
            Start a new session or use <kbd>⌘K</kbd> to search.
          </p>
          <button
            className={styles.emptyStartBtn}
            onClick={() => createSession("assistant", {
              storyId: activeStory?.id,
              nodeId: activeNode?.id,
            })}
          >
            <Feather size={13} />
            New Assistant Session
          </button>
        </div>
      )}
    </aside>
  );
}
