import type { ComponentType, ReactNode } from "react";
import { Database, Settings2 } from "lucide-react";
import type { AISession } from "../../stores/aiStore";
import type { useAIModeState } from "../../hooks/useAIModeState";
import { LLMTransparencyModal, LLMTransparencyTrigger, ChatSettingsModal } from "../llm";
import styles from "./AIModeWrapper.module.css";

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
}: Props) {
  const {
    sessionParams, setSessionParams,
    showSettings, setShowSettings,
    transparency,
    ctxPct, ctxWarning, tokenTooltip,
  } = state;

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
      />

      <div className={styles.subHeader}>
        {!hideTitle && <Icon size={14} className={styles.headerIcon} />}
        {!hideTitle && <span className={styles.title}>{title}</span>}

        {headerExtra}

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

        {!hideSettings && (
          <button
            className={`${styles.headerBtn} ${sessionParams ? styles.headerBtnActive : ""}`}
            onClick={() => setShowSettings(true)}
            title="AI parameters"
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>

      {contextBar && <div className={styles.contextBarSlot}>{contextBar}</div>}

      {children}
    </>
  );
}
