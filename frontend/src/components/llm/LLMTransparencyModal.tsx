import { ShieldCheck } from "lucide-react";
import { Modal, CollapsibleSection, CodeBlock } from "../common";
import AICallDetail from "../chronicle/AICallDetail";
import type { LLMInteractionData } from "../../types";
import styles from "./LLMTransparencyModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: LLMInteractionData | null;
}

export default function LLMTransparencyModal({ isOpen, onClose, data }: Props) {
  async function copyAll() {
    if (!data?.preview) return;
    const text = [
      "=== CONTEXT SENT TO AI ===",
      data.preview.system_prompt,
      "",
      "=== YOUR MESSAGE ===",
      data.preview.user_message,
      "",
      "=== AI RESPONSE ===",
      data.response,
    ].join("\n");
    await navigator.clipboard.writeText(text);
  }

  const footer = (
    <>
      {!data?.callId && (
        <button className={styles.copyAllBtn} onClick={copyAll} disabled={!data?.preview}>
          Copy all
        </button>
      )}
      <button className={styles.closeBtn} onClick={onClose}>
        Close
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data?.callId ? "What was sent to the AI" : "What the AI would be sent"}
      icon={<ShieldCheck size={15} />}
      size="lg"
      footer={footer}
    >
      {!data ? (
        <p className={styles.empty}>No interaction yet. Use an AI feature first.</p>
      ) : data.callId ? (
        // The call that ran: its messages, its options, its raw response.
        <AICallDetail logId={data.callId} />
      ) : !data.preview ? (
        <p className={styles.empty}>The context for this interaction could not be loaded.</p>
      ) : (
        <div className={styles.content}>
          <CollapsibleSection title="Context sent to AI" defaultOpen>
            <CodeBlock content={data.preview.system_prompt} maxHeight="220px" copyable />
          </CollapsibleSection>

          <CollapsibleSection title="Your message" defaultOpen>
            <CodeBlock content={data.preview.user_message} />
          </CollapsibleSection>

          {data.response && (
            <CollapsibleSection title="AI response">
              <CodeBlock content={data.response} maxHeight="180px" copyable />
            </CollapsibleSection>
          )}

          <p className={styles.details}>
            Model: <span className={styles.detailValue}>{data.preview.model}</span>
            {" · "}
            <span className={styles.detailValue}>{data.preview.context_type}</span>
          </p>

          <p className={styles.notice}>
            This feature has not run here yet, so this is what would be sent. Once it runs, this view shows
            the call itself.
          </p>
        </div>
      )}
    </Modal>
  );
}
