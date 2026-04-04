import { X } from "lucide-react";
import styles from "./Modal.module.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  size = "md",
  children,
  footer,
  zIndex,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      style={zIndex !== undefined ? { zIndex } : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${styles.dialog} ${styles[size]}`}>
        <div className={styles.header}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
