import { useEffect, useState } from "react";
import { inDesktopApp, installUpdate } from "../../lib/desktop";
import { toast } from "../../stores/toastStore";
import { useUpdateStore } from "../../stores/updateStore";
import { formatRelative } from "../../lib/utils";
import type { UpdateStatus } from "../../types/system";
import styles from "../../pages/Settings.module.css";

const UPGRADING = "https://github.com/brentonmallen1/LoreStudio/blob/main/docs/upgrading.md";

/** How to update, by how LoreStudio was installed. */
function HowToUpdate({ status }: { status: UpdateStatus }) {
  if (status.install === "desktop" && inDesktopApp()) {
    return (
      <p className={styles.sectionHint}>
        <strong>Install and restart</strong> downloads LoreStudio {status.latest}, replaces this app and opens
        it again. Your stories and settings stay where they are, and the database is copied to{" "}
        <code>backups/</code> before it is upgraded.
      </p>
    );
  }
  if (status.install === "desktop") {
    return (
      <p className={styles.sectionHint}>
        Download <strong>LoreStudio.dmg</strong> from the release page, open it and drag LoreStudio into
        Applications, replacing this one. Your stories and settings stay where they are.
      </p>
    );
  }
  if (status.install === "docker") {
    return (
      <p className={styles.sectionHint}>
        Pull the new image and restart: <code>docker compose pull && docker compose up -d</code>. On Unraid,{" "}
        <em>Docker › Check for Updates</em>, then <strong>Update</strong>. Your data folder is untouched, and
        the database is copied to <code>backups/</code> before it is upgraded.{" "}
        <a href={UPGRADING} target="_blank" rel="noreferrer">
          More on upgrading
        </a>
        .
      </p>
    );
  }
  return (
    <p className={styles.sectionHint}>
      From your checkout: <code>git pull && just setup</code>, then start LoreStudio again. The database is
      copied to <code>backups/</code> before it is upgraded.{" "}
      <a href={UPGRADING} target="_blank" rel="noreferrer">
        More on upgrading
      </a>
      .
    </p>
  );
}

/** The desktop app installs the update itself, showing the download as it goes. */
function InstallAndRestart({ version }: { version: string | null }) {
  // undefined: not installing; null: started, size not known yet; else the fraction downloaded.
  const [progress, setProgress] = useState<number | null | undefined>(undefined);

  async function install() {
    setProgress(null);
    try {
      // On success the app restarts and this never returns.
      if (!(await installUpdate(setProgress))) {
        toast.info(
          `The desktop app for LoreStudio ${version} is still being built. Try again in a few minutes.`,
        );
      }
    } catch (err) {
      toast.error(`The update did not install: ${String(err)}`);
    }
    setProgress(undefined);
  }

  return (
    <button className={styles.saveBtn} onClick={() => void install()} disabled={progress !== undefined}>
      {progress === undefined
        ? "Install and restart"
        : progress === null
          ? "Downloading…"
          : `Downloading… ${Math.round(progress * 100)}%`}
    </button>
  );
}

/**
 * Settings › About and updates: which LoreStudio this is, and whether a newer one is out.
 * Checking asks GitHub; it happens when you press Check now, or daily if switched on under
 * Automatic work (off by default).
 */
export default function AboutSection() {
  const { status, checking, load, check } = useUpdateStore();

  useEffect(() => {
    void load();
  }, [load]);

  async function checkNow() {
    try {
      const found = await check();
      if (found.error) toast.error(found.error);
      else if (!found.available) toast.success("LoreStudio is up to date.");
    } catch {
      toast.error("The check did not run. Try again in a moment.");
    }
  }

  if (!status) return <p className={styles.hint}>Status unavailable</p>;
  const dev = status.current === "dev";

  return (
    <div className={styles.card}>
      <div className={styles.backupForm}>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Version</span>
          <span>{dev ? "Development build" : `LoreStudio ${status.current}`}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Latest</span>
          <span>
            {!status.latest
              ? "Not checked yet"
              : status.available
                ? `LoreStudio ${status.latest} is available`
                : dev
                  ? `LoreStudio ${status.latest}`
                  : "This is the latest"}
            {status.url && (
              <>
                {" · "}
                <a href={status.url} target="_blank" rel="noreferrer">
                  Release notes
                </a>
              </>
            )}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Checked</span>
          <span>{status.checked_at ? formatRelative(status.checked_at) : "Never"}</span>
        </div>
        {status.error && <p className={styles.hint}>{status.error}</p>}
        {status.available && <HowToUpdate status={status} />}
        <div className={styles.cardFooter}>
          {status.available && status.install === "desktop" && inDesktopApp() && (
            <InstallAndRestart version={status.latest} />
          )}
          <button className={styles.saveBtn} onClick={() => void checkNow()} disabled={checking}>
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>
      </div>
      <p className={styles.sectionHint}>
        Checking asks GitHub for the latest release; nothing about you or your stories is sent. It happens
        when you press Check now
        {status.automatic ? (
          <>
            , and once a day (<a href="#automatic">Automatic work</a>).
          </>
        ) : (
          <>
            , or once a day if you switch that on under <a href="#automatic">Automatic work</a>.
          </>
        )}
      </p>
    </div>
  );
}
