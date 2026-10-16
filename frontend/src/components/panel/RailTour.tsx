import { useCallback, useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { welcomePending } from "../../lib/mode";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../../lib/preferences/accountPrefs";
import { RAIL_TOUR_EVENT, RAIL_TOUR_PREF, railTourSeen } from "../../lib/panel/railWords";
import styles from "./RailTour.module.css";

interface Label {
  text: string;
  top: number;
  right: number;
}

/** Long enough for the account's preferences to arrive, so a writer who has seen it elsewhere never does. */
const SETTLE_MS = 1200;

/**
 * The side panel's rail, labelled once (doc 30 D8). The rail is a column of icons by design:
 * a column of words beside the prose on every page would cost the writing its room, and the
 * words are needed once. So the first time a writer meets the rail, every button wears its
 * name and what it opens, beside it; "Got it" puts them away for good, on the account, and
 * the palette's "Show what the side panel's buttons do" brings them back. After that the same
 * words show on hover and on keyboard focus.
 *
 * Each button names itself with `data-rail-tour`, so the tour can never miss a new one.
 */
export default function RailTour({ rail }: { rail: RefObject<HTMLElement | null> }) {
  const asking = useAuthStore((s) => welcomePending(s.user?.settings));
  const [on, setOn] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    if (railTourSeen()) return;
    const timer = setTimeout(() => setOn(!railTourSeen()), SETTLE_MS);
    const adopted = () => railTourSeen() && setOn(false);
    window.addEventListener(PREFS_ADOPTED_EVENT, adopted);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(PREFS_ADOPTED_EVENT, adopted);
    };
  }, []);

  useEffect(() => {
    const again = () => setOn(true);
    window.addEventListener(RAIL_TOUR_EVENT, again);
    return () => window.removeEventListener(RAIL_TOUR_EVENT, again);
  }, []);

  useEffect(() => {
    if (!on) return;
    // On the next frame, so the rail has laid out (and no state is set while the effect runs).
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const buttons = rail.current?.querySelectorAll<HTMLElement>("[data-rail-tour]") ?? [];
        setLabels(
          [...buttons].map((b) => {
            const r = b.getBoundingClientRect();
            return {
              text: b.dataset.railTour ?? "",
              top: r.top + r.height / 2,
              right: window.innerWidth - r.left + 8,
            };
          }),
        );
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [on, rail]);

  const done = useCallback(() => {
    rememberPref(RAIL_TOUR_PREF, "seen");
    setOn(false);
  }, []);

  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on, done]);

  if (!on || asking || labels.length === 0) return null;
  const last = labels[labels.length - 1];
  return createPortal(
    <div className={styles.tour}>
      <section
        className={styles.card}
        style={{ top: last.top + 24, right: last.right }}
        role="dialog"
        aria-label="The side panel's buttons"
      >
        <h2 className={styles.title}>The side panel</h2>
        <p className={styles.text}>
          Each button opens something beside your writing; choose it again to fold the panel away. Point at a
          button, or reach it with Tab, to see its name again.
        </p>
        <button type="button" className={styles.done} onClick={done}>
          Got it
        </button>
      </section>
      <ul className={styles.labels} aria-hidden>
        {labels.map((l, i) => (
          <li key={i} className={styles.label} style={{ top: l.top, right: l.right }}>
            {l.text}
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
