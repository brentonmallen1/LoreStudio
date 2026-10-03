import { UI_SCALES } from "../../lib/appearance/uiScale";
import { useUIStore } from "../../stores/uiStore";

/**
 * The interface size choices (doc 17): Settings › Typography and the header's quick menu
 * share them. The writing keeps its own size.
 */
export default function InterfaceSizeButtons({
  rowClass,
  buttonClass,
  activeClass,
}: {
  rowClass: string;
  buttonClass: string;
  activeClass: string;
}) {
  const uiScale = useUIStore((s) => s.uiScale);
  const setUiScale = useUIStore((s) => s.setUiScale);
  return (
    <div className={rowClass} role="group" aria-label="Interface size">
      {UI_SCALES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setUiScale(value)}
          aria-pressed={uiScale === value}
          className={`${buttonClass} ${uiScale === value ? activeClass : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
