import { useEffect, useRef, useState } from "react";
import type { ScriptLayout } from "../../types";
import styles from "./ScriptPages.module.css";

/** CSS pixels to a point. */
const PX_PER_PT = 96 / 72;

/**
 * A screenplay's pages as they print (doc 25, P3): the server's layout, the one the PDF is drawn
 * from, line for line. Each page is drawn at its true size and scaled to fit the column, so what
 * you see is what exports.
 */
export default function ScriptPages({ layout }: { layout: ScriptLayout }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const width = layout.width_pt * PX_PER_PT;
  const height = layout.height_pt * PX_PER_PT;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // An unlaid column (width 0) keeps the true size rather than shrinking the pages away.
    const fit = () => el.clientWidth && setScale(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const titled = layout.pages.length > layout.page_count;
  return (
    <div ref={ref} className={styles.pages}>
      {layout.pages.map((items, i) => (
        <div
          key={i}
          className={styles.slot}
          style={{ width: width * scale, height: height * scale }}
          aria-label={titled && i === 0 ? "Title page" : `Page ${titled ? i : i + 1}`}
          role="img"
        >
          <div className={styles.page} style={{ width, height, transform: `scale(${scale})` }}>
            {items.map((line, j) => (
              <span
                key={j}
                className={[
                  styles.line,
                  line.kind === "bold" && styles.bold,
                  line.kind === "centre" && styles.centre,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  top: line.top * PX_PER_PT,
                  left: line.kind === "centre" ? 0 : line.left * PX_PER_PT,
                }}
              >
                {line.text}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
