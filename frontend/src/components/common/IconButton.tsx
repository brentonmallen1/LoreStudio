import styles from "./IconButton.module.css";

interface IconButtonProps {
  icon: React.ReactNode;
  label?: string;
  tooltip?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  variant?: "ghost" | "subtle";
}

export default function IconButton({
  icon,
  label,
  tooltip,
  onClick,
  active = false,
  disabled = false,
  size = "sm",
  variant = "ghost",
}: IconButtonProps) {
  return (
    <button
      className={[styles.btn, styles[size], styles[variant], active ? styles.active : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={label ? undefined : tooltip}
    >
      {icon}
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
