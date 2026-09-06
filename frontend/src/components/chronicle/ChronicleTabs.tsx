import { Activity, History, Library, MessageSquare } from "lucide-react";
import styles from "../../pages/ChroniclePage.module.css";

export type ViewTab = "chats" | "activity" | "changes" | "summaries" | "search";

const TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: "chats", label: "Conversations", icon: <MessageSquare size={12} /> },
  { id: "activity", label: "AI activity", icon: <Activity size={12} /> },
  { id: "changes", label: "Changes", icon: <History size={12} /> },
  { id: "summaries", label: "Summaries", icon: <Library size={12} /> },
];

export default function ChronicleTabs({
  tab,
  counts,
  onSelect,
}: {
  tab: ViewTab;
  counts: Partial<Record<ViewTab, number>>;
  onSelect: (tab: ViewTab) => void;
}) {
  return (
    <>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`${styles.filterBtn} ${tab === t.id ? styles.activeFilter : ""}`}
          onClick={() => onSelect(t.id)}
        >
          {t.icon}
          <span style={{ flex: 1 }}>{t.label}</span>
          {counts[t.id] !== undefined && <span className={styles.tabCount}>{counts[t.id]}</span>}
        </button>
      ))}
    </>
  );
}
