import { useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./Lightbox.module.css";

interface Props {
  url: string;
  alt: string;
  filename?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function Lightbox({ url, alt, filename, onClose, onPrev, onNext }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    },
    [onClose, onPrev, onNext],
  );

  useEffect(() => {
    setLoaded(false);
    setZoomed(false);
  }, [url]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toolbar}>
          {filename && <span className={styles.filename}>{filename}</span>}
          <div className={styles.toolbarActions}>
            <button
              className={styles.toolBtn}
              onClick={() => setZoomed((v) => !v)}
              title={zoomed ? "Fit to screen" : "Zoom 100%"}
            >
              {zoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
            </button>
            <button className={styles.toolBtn} onClick={onClose} title="Close (Esc)" aria-label="Close (Esc)">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className={`${styles.imageWrap} ${zoomed ? styles.imageWrapZoomed : ""}`}>
          {!loaded && <div className={styles.spinner} />}
          <img
            src={url}
            alt={alt}
            className={`${styles.image} ${loaded ? styles.imageLoaded : ""} ${zoomed ? styles.imageZoomed : ""}`}
            onLoad={() => setLoaded(true)}
            onClick={() => setZoomed((v) => !v)}
            title={zoomed ? "Click to fit" : "Click to zoom"}
          />
        </div>

        {onPrev && (
          <button
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={onPrev}
            title="Previous (←)"
            aria-label="Previous (←)"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {onNext && (
          <button
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={onNext}
            title="Next (→)"
            aria-label="Next (→)"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
