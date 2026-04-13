import { useState, type ComponentType, type ReactNode } from "react";
import { Database, Settings2, Plus, SlidersHorizontal, FoldVertical, AlertTriangle } from "lucide-react";
import type { AISession } from "../../stores/aiStore";
import { useAIStore } from "../../stores/aiStore";
import type { useAIModeState } from "../../hooks/useAIModeState";
import { getSessionType, type ContextScope } from "../../lib/ai/sessionTypes";
import { LLMTransparencyModal, LLMTransparencyTrigger, ChatSettingsModal } from "../llm";
import ContextScopeSelector from "./ContextScopeSelector";
import { SessionIndicator } from "./shared/SessionSwitcher";
import ContextOptionsPanel from "./shared/ContextOptionsPanel";
import SummarizePreviewModal from "./shared/SummarizePreviewModal";
import { api } from "../../api/client";
import type { ContextOptions } from "../../types";
import styles from "./AIModeWrapper.module.css";

const SUMMARIZE_THRESHOLD = 8;

interface Props {
  session: AISession;
  state: ReturnType<typeof useAIModeState>;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  /** Mode-specific controls rendered after the title (pickers, toggles, etc.) */
  headerExtra?: ReactNode;
  /** Strip rendered below the sub-header (e.g. InterviewMode's story context bar) */
  contextBar?: ReactNode;
  children: ReactNode;
  hideTokenBadge?: boolean;
  hideSettings?: boolean;
  /** Hide the icon + title (for modes that put a full custom header in headerExtra) */
  hideTitle?: boolean;
  /** When provided, renders the transparency trigger using this callback */
  onTransparencyClick?: () => void;
  /** When true, shows the context options (sliders) button for selective context */
  showContextOptions?: boolean;
}

export default function AIModeWrapper({
  session,
  state,
  icon: Icon,
  title,
  headerExtra,
  contextBar,
  children,
  hideTokenBadge = false,
  hideSettings = false,
  hideTitle = false,
  onTransparencyClick,
  showContextOptions = false,
}: Props) {
  const {
    sessionParams, setSessionParams,
    showSettings, setShowSettings,
    transparency,
    ctxPct, ctxWarning, tokenTooltip,
  } = state;

  const [showCtxOptions, setShowCtxOptions] = useState(false);
  const [showSummarize, setShowSummarize] = useState(false);
  const { updateSessionContext, startFreshSession, applySummary, setAutoSummarize } = useAIStore();
  const sessionType = getSessionType(session.type);

  function handleContextOptionsChange(opts: ContextOptions) {
    updateSessionContext(session.id, { contextOptions: opts });
  }

  async function handleNewChat() {
    if (session.chronicleSessionId) {
      try { await api.updateChronicleSession(session.chronicleSessionId, { archived: true }); } catch { /* ignore */ }
    }
    startFreshSession(session.id);
  }
  const allowedScopes = sessionType?.allowedScopes;
  const currentScope: ContextScope = session.context.contextScope ?? sessionType?.defaultScope ?? "current-scene";

  function handleScopeChange(scope: ContextScope) {
    updateSessionContext(session.id, { contextScope: scope });
  }

  return (
    <>
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApply={setSessionParams}
        sessionParams={sessionParams}
        autoSummarize={session.autoSummarize ?? false}
        onAutoSummarizeChange={(enabled) => setAutoSummarize(session.id, enabled)}
      />
      <SummarizePreviewModal
        isOpen={showSummarize}
        onClose={() => setShowSummarize(false)}
        messages={session.messages}
        storyId={session.context.storyId}
        onApply={(summaryText, keepRecent) => applySummary(session.id, summaryText, keepRecent)}
      />

      <div className={styles.subHeader}>
        {!hideTitle && <Icon size={14} className={styles.headerIcon} />}
        {!hideTitle && <span className={styles.title}>{title}</span>}

        {headerExtra}

        <SessionIndicator session={session} />

        {allowedScopes && allowedScopes.length > 1 && (
          <ContextScopeSelector
            scope={currentScope}
            allowedScopes={allowedScopes}
            onChange={handleScopeChange}
          />
        )}

        {!hideTokenBadge && session.messages.length > 0 && (
          <div
            className={styles.ctxMeter}
            data-warning={ctxWarning}
            title={tokenTooltip}
          >
            <Database size={10} />
            <div className={styles.ctxMeterBar}>
              <div className={styles.ctxMeterFill} style={{ width: `${ctxPct}%` }} />
            </div>
            <span>{ctxPct}%</span>
          </div>
        )}

        {onTransparencyClick && (
          <LLMTransparencyTrigger
            disabled={!transparency.hasData}
            onClick={onTransparencyClick}
          />
        )}

        {showContextOptions && (
          <div className={styles.ctxOptionWrap}>
            <button
              className={`${styles.headerBtn} ${showCtxOptions ? styles.headerBtnActive : ""}`}
              onClick={() => setShowCtxOptions((v) => !v)}
              title="Context options"
            >
              <SlidersHorizontal size={13} />
            </button>
            {showCtxOptions && (
              <ContextOptionsPanel
                options={session.context.contextOptions}
                onChange={handleContextOptionsChange}
                onClose={() => setShowCtxOptions(false)}
              />
            )}
          </div>
        )}

        {session.messages.length >= SUMMARIZE_THRESHOLD && (
          <button
            className={`${styles.headerBtn} ${styles.summarizeBtn}`}
            onClick={() => setShowSummarize(true)}
            title="Summarize conversation"
          >
            <FoldVertical size={13} />
          </button>
        )}

        {!hideSettings && (
          <button
            className={`${styles.headerBtn} ${sessionParams ? styles.headerBtnActive : ""}`}
            onClick={() => setShowSettings(true)}
            title="AI parameters"
          >
            <Settings2 size={13} />
          </button>
        )}

        <button
          className={`${styles.headerBtn} ${styles.newChatBtn}`}
          onClick={handleNewChat}
          disabled={session.messages.length === 0}
          title="Start new conversation"
        >
          <Plus size={13} />
        </button>
      </div>

      {contextBar && <div className={styles.contextBarSlot}>{contextBar}</div>}

      {(ctxWarning === "exceeded" || ctxWarning === "critical") && session.messages.length > 0 && (
        <div className={styles.contextWarning} data-level={ctxWarning}>
          <AlertTriangle size={12} />
          <span>
            {ctxWarning === "critical"
              ? "Context limit nearly reached"
              : "Context limit approaching"}
          </span>
          <button className={styles.contextWarnBtn} onClick={() => setShowSummarize(true)}>
            Summarize
          </button>
          <button
            className={styles.contextWarnBtn}
            onClick={handleNewChat}
            disabled={session.messages.length === 0}
          >
            New chat
          </button>
        </div>
      )}

      {children}
    </>
  );
}
