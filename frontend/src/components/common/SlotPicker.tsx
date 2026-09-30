import { Check } from "lucide-react";
import { SLOT_COUNT, slotFgVar, slotVar } from "../../lib/colorSlots";
import styles from "./SlotPicker.module.css";

interface Props {
  value: number;
  onChange: (slot: number) => void;
  label?: string;
  size?: "sm" | "md";
}

/** Eight swatches from the theme's palette slots; the chosen one shows a tick (doc 11 P2). */
export default function SlotPicker({ value, onChange, label = "Colour", size = "md" }: Props) {
  return (
    <div className={`${styles.row} ${size === "sm" ? styles.sm : ""}`} role="radiogroup" aria-label={label}>
      {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => (
        <button
          key={slot}
          type="button"
          role="radio"
          aria-checked={value === slot}
          aria-label={`${label} ${slot}`}
          className={`${styles.swatch} ${value === slot ? styles.selected : ""}`}
          style={{ background: slotVar(slot), color: slotFgVar(slot) }}
          onClick={() => onChange(slot)}
        >
          {value === slot && <Check size={size === "sm" ? 10 : 12} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
