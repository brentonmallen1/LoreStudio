import { useEffect, useRef, useState, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { currentHeading, type PageHeading } from "../../lib/guides/headings";
import styles from "./PageContents.module.css";

/** How far below the top of the guide's scroll area a heading counts as reached. */
const LINE = 96;

/** The element the guide scrolls in: the overlay's body, or the window. */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

function scrollToId(id: string, smooth: boolean) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ block: "start", behavior: smooth && !reduce ? "smooth" : "auto" });
}

/**
 * "On this page" beside a guide (Brenton, 2026-10-13, after the scikit-learn docs): its
 * sections and their parts, with the one being read marked as the page scrolls. A link to a
 * section is the guide's address with #section, so it can be shared and opens there.
 */
export default function PageContents({
  article,
  guideKey,
}: {
  article: RefObject<HTMLElement | null>;
  guideKey: string;
}) {
  const [headings, setHeadings] = useState<PageHeading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const { hash } = useLocation();
  const navigate = useNavigate();
  // A section chosen here scrolls smoothly itself; its #address must not jump there again.
  const chosen = useRef<string | null>(null);
  // The section in the address, for the end of the page (currentHeading).
  const goneTo = useRef("");
  useEffect(() => {
    goneTo.current = decodeURIComponent(hash.slice(1));
  }, [hash]);

  // Read once the guide is drawn, its inserted pieces too (the Typing guide's groups).
  useEffect(() => {
    const root = article.current;
    if (!root) return;
    const area = scroller(root);
    const els = () => Array.from(root.querySelectorAll<HTMLElement>("h2[id], h3[id]"));

    function spy() {
      const top = area ? area.getBoundingClientRect().top : 0;
      const atEnd = area
        ? area.scrollTop + area.clientHeight >= area.scrollHeight - 4
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const tops = els().map((el) => ({ id: el.id, top: el.getBoundingClientRect().top - top }));
      const scrolled = (area?.scrollTop ?? window.scrollY) > 0;
      const height = area?.clientHeight ?? window.innerHeight;
      setActive(
        currentHeading(tops, LINE, atEnd && scrolled ? { height, chosen: goneTo.current } : undefined),
      );
    }

    const frame = requestAnimationFrame(() => {
      setHeadings(
        els().map((el) => ({
          id: el.id,
          text: el.textContent ?? "",
          level: el.tagName === "H3" ? 3 : 2,
        })),
      );
      spy();
    });
    const target: HTMLElement | Window = area ?? window;
    target.addEventListener("scroll", spy, { passive: true });
    window.addEventListener("resize", spy);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", spy);
      window.removeEventListener("resize", spy);
    };
  }, [article, guideKey]);

  // A guide opened at #section, or a link to one followed, scrolls there.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    if (chosen.current === id) {
      chosen.current = null;
      return;
    }
    const go = () => {
      scrollToId(id, false);
      setActive(id);
    };
    const frame = requestAnimationFrame(go);
    // A piece above or at the section can still be loading (the samples' list): while the
    // guide settles, it goes there again each time the page changes size, until the reader
    // scrolls themselves.
    const root = article.current;
    const settle = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(go) : null;
    if (root) settle?.observe(root);
    const stop = () => settle?.disconnect();
    const timer = window.setTimeout(stop, 2000);
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchmove", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [article, hash, guideKey]);

  if (headings.length < 2) return <div className={styles.empty} />;

  return (
    <nav className={styles.contents} aria-label="On this page">
      <p className={styles.title}>On this page</p>
      <ul className={styles.list}>
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? styles.sub : undefined}>
            <a
              href={`#${h.id}`}
              className={`${styles.link} ${h.id === active ? styles.active : ""}`}
              aria-current={h.id === active ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (hash !== `#${h.id}`) {
                  chosen.current = h.id;
                  navigate({ hash: h.id }, { replace: true });
                }
                goneTo.current = h.id;
                setActive(h.id);
                scrollToId(h.id, true);
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
