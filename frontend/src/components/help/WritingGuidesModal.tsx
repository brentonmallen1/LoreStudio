import { useState, useEffect } from "react";
import { Quote, BookOpen, BookMarked } from "lucide-react";
import { Modal } from "../common";
import { DialogueSyntaxContent } from "./DialogueSyntaxGuide";
import { MICEContent } from "./MICEGuide";
import { EssentialQuestionsContent } from "./EssentialQuestionsGuide";
import styles from "./WritingGuidesModal.module.css";

export type WritingGuideTab = "dialogue" | "mice" | "essential";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WritingGuideTab;
}

const TABS: { id: WritingGuideTab; label: string; icon: React.ReactNode }[] = [
  { id: "dialogue", label: "Dialogue", icon: <Quote size={13} /> },
  { id: "mice", label: "MICE Quotient", icon: <BookOpen size={13} /> },
  { id: "essential", label: "6 Essential Questions", icon: <BookMarked size={13} /> },
];

export default function WritingGuidesModal({ isOpen, onClose, initialTab = "dialogue" }: Props) {
  const [activeTab, setActiveTab] = useState<WritingGuideTab>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Writing Reference"
      icon={<BookOpen size={15} />}
      size="lg"
      footer={
        <button onClick={onClose} className={styles.closeBtn}>
          Close
        </button>
      }
    >
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className={styles.tabIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabBody}>
        {activeTab === "dialogue" && <DialogueSyntaxContent />}
        {activeTab === "mice" && <MICEContent />}
        {activeTab === "essential" && <EssentialQuestionsContent />}
      </div>
    </Modal>
  );
}
