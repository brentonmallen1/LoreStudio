import { Minus, X, Plus, MessageSquare } from "lucide-react";
import { useAIStore } from "../../stores/aiStore";
import { getSessionType } from "../../lib/ai/sessionTypes";
import SessionView from "./SessionView";
import styles from "./AIPanel.module.css";

export default function AIPanel() {
  const {
    panelOpen,
    panelCollapsed,
    sessions,
    activeSessionId,
    closePanel,
    collapsePanel,
    expandPanel,
    closeSession,
    setActiveSession,
  } = useAIStore();

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
        <MessageSquare size={16} className={styles.collapsedIcon} />
        {sessions.length > 0 && (
          <span className={styles.collapsedCount} aria-hidden="true">{sessions.length}</span>
        )}
      </button>
    );
  }

  return (
    <aside className={styles.panel}>
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
            <span className={styles.tabEmpty}>No sessions</span>
          )}
        </div>
        <div className={styles.tabControls}>
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
          <Plus size={24} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No active session</p>
          <p className={styles.emptyHint}>
            Use <kbd>⌘K</kbd> to open a new session
          </p>
        </div>
      )}
    </aside>
  );
}
