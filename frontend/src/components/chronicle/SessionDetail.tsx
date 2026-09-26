import { useEffect, useState } from "react";
import { Feather } from "lucide-react";
import { api } from "../../api/client";
import type { ChronicleSessionDetail } from "../../types";
import { relativeTime } from "../../utils/relativeTime";
import AIOnly from "../ai/AIOnly";
import { sessionTitle, useResumeSession } from "./sessions";
import styles from "./Conversations.module.css";

/** A conversation, read back in the detail panel. */
export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const [detail, setDetail] = useState<ChronicleSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const resume = useResumeSession();

  useEffect(() => {
    api
      .getChronicleSession(sessionId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <p className={styles.empty}>Loading…</p>;
  if (!detail) return <p className={styles.empty}>This conversation no longer exists.</p>;

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <h2 className={styles.detailTitle}>{sessionTitle(detail)}</h2>
          <span className={styles.cardMeta}>
            {detail.message_count} messages · {relativeTime(detail.updated_at)}
          </span>
        </div>
        <AIOnly>
          <button type="button" className={styles.resumeBtn} onClick={() => resume(detail)}>
            <Feather size={13} /> Resume in AI panel
          </button>
        </AIOnly>
      </div>

      <div className={styles.messages}>
        {detail.messages.length === 0 && <p className={styles.empty}>No messages in this conversation.</p>}
        {detail.messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === "user" ? styles.userMsg : styles.assistantMsg}`}
          >
            <p className={styles.msgRole}>{msg.role === "user" ? "You" : "Assistant"}</p>
            <p className={styles.msgContent}>{msg.content}</p>
            <div className={styles.msgFooter}>
              <span>{relativeTime(msg.created_at)}</span>
              {msg.model && <span className={styles.msgModel}>{msg.model}</span>}
              {msg.tokens_in != null && (
                <span>
                  {msg.tokens_in}↑ {msg.tokens_out}↓ tokens
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
