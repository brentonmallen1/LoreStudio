import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SETTINGS_SECTIONS, settingsPath } from "../../pages/settings/sections";
import { useMode } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

/** Left rail of the Settings page, rendered from pages/settings/sections.ts. Scrolls to `#hash` on load. */
export default function SettingsNav() {
  const mode = useMode();
  const location = useLocation();
  const [current, setCurrent] = useState<string>(location.hash.replace("#", "") || "appearance");

  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: "start" });
      setCurrent(id);
    }
  }, [location.hash]);

  const sections = SETTINGS_SECTIONS.filter((s) => s.modes.includes(mode));
  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {sections.map((s) => {
        const Icon = s.icon;
        const active = location.pathname === s.path || (!s.path && current === s.id);
        return (
          <Link
            key={s.id}
            to={settingsPath(s)}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
            onClick={() => !s.path && setCurrent(s.id)}
          >
            <Icon size={13} />
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
