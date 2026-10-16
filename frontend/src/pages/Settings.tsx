import { Sun, Moon, Monitor, Feather, BookOpen } from "lucide-react";
import { useUIStore, THEME_META } from "../stores/uiStore";
import type { ThemeName, ColorMode } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import { useModelSettings } from "./settings/useModelSettings";
import AssistantConnection from "../components/settings/AssistantConnection";
import AdvancedSection from "../components/settings/AdvancedSection";
import AutomaticWorkSection from "../components/settings/AutomaticWorkSection";
import AboutSection from "../components/settings/AboutSection";
import DatabaseBackupCard from "../components/settings/DatabaseBackupCard";
import ExampleStoriesCard from "../components/settings/ExampleStoriesCard";
import ModeToggle from "../components/settings/ModeToggle";
import TypographySection from "../components/settings/TypographySection";
import ShortcutsSection from "../components/settings/ShortcutsSection";
import WritingSection from "../components/settings/WritingSection";
import AISwitchCard from "../components/settings/AISwitchCard";
import BackupDefaultsCard from "../components/settings/BackupDefaultsCard";
import CodexSection from "../components/settings/CodexSection";
import PrivacySection from "../components/settings/PrivacySection";
import SettingsNav from "../components/settings/SettingsNav";
import { useMode } from "../lib/mode";
import styles from "./Settings.module.css";

// ── Page ─────────────────────────────────────────────────────────────────────

const THEME_SWATCHES: Record<string, string[]> = {
  zen: ["#f7f6f3", "#4a7c59", "#8b6aa8"],
  "e-ink": ["#ede9de", "#4a7a58", "#7a5a98"],
  nord: ["#ECEFF4", "#5E81AC", "#BF616A"],
  solarized: ["#fdf6e3", "#2aa198", "#dc322f"],
  dracula: ["#282A36", "#50FA7B", "#BD93F9"],
  gruvbox: ["#fbf1c7", "#d65d0e", "#b16286"],
  catppuccin: ["#EFF1F5", "#8839EF", "#C6A0F6"],
};

export default function SettingsPage() {
  const { themeName, colorMode, setThemeName, setColorMode } = useUIStore();
  const studio = useMode() === "studio";
  const { user } = useAuthStore();
  const model = useModelSettings();

  const customThemeOptions: { value: ThemeName; label: string; Icon: typeof Feather }[] = [
    { value: "zen", label: "Zen", Icon: Feather },
    { value: "e-ink", label: "E-ink", Icon: BookOpen },
  ];

  const presetThemeOptions: { value: ThemeName; label: string }[] = [
    { value: "nord", label: "Nord" },
    { value: "solarized", label: "Solarized" },
    { value: "dracula", label: "Dracula" },
    { value: "gruvbox", label: "Gruvbox" },
    { value: "catppuccin", label: "Catppuccin" },
  ];

  const colorModeOptions: { value: ColorMode; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.layout}>
        <SettingsNav />
        <main className={styles.main}>
          <section className={styles.section} id="mode">
            <h2 className={styles.sectionLabel}>Mode</h2>
            <ModeToggle />
          </section>

          <section className={styles.section} id="appearance">
            <h2 className={styles.sectionLabel}>Appearance</h2>

            <div className={styles.settingGroup}>
              <p className={styles.settingGroupLabel}>Theme</p>
              <div className={styles.themeSubGroup}>
                <p className={styles.themeSubLabel}>Custom</p>
                <div className={styles.themeRow}>
                  {customThemeOptions.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setThemeName(value)}
                      aria-pressed={themeName === value}
                      className={`${styles.themeOption} ${themeName === value ? styles.active : ""}`}
                    >
                      <div className={styles.themeSwatch}>
                        {THEME_SWATCHES[value].map((color, i) => (
                          <span key={i} className={styles.swatchDot} style={{ background: color }} />
                        ))}
                      </div>
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.themeSubGroup}>
                <p className={styles.themeSubLabel}>Presets</p>
                <div className={styles.themePresetGrid}>
                  {presetThemeOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setThemeName(value)}
                      aria-pressed={themeName === value}
                      className={`${styles.themeOption} ${themeName === value ? styles.active : ""}`}
                    >
                      <div className={styles.themeSwatch}>
                        {THEME_SWATCHES[value].map((color, i) => (
                          <span key={i} className={styles.swatchDot} style={{ background: color }} />
                        ))}
                      </div>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.settingGroup}>
              <p className={styles.settingGroupLabel}>Color mode</p>
              <div className={styles.themeRow}>
                {colorModeOptions.map(({ value, label, Icon }) => {
                  const isDisabled = value === "light" && THEME_META[themeName].darkOnly;
                  return (
                    <button
                      key={value}
                      onClick={() => setColorMode(value)}
                      disabled={isDisabled}
                      aria-pressed={colorMode === value}
                      className={`${styles.themeOption} ${colorMode === value ? styles.active : ""}`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Typography */}
          <section className={styles.section} id="typography">
            <h2 className={styles.sectionLabel}>Typography</h2>
            <TypographySection />
          </section>

          <section className={styles.section} id="writing">
            <h2 className={styles.sectionLabel}>Writing</h2>
            <WritingSection />
          </section>

          <section className={styles.section} id="shortcuts">
            <h2 className={styles.sectionLabel}>Shortcuts</h2>
            <ShortcutsSection />
          </section>

          {studio && (
            <>
              <section className={styles.section} id="ai">
                <h2 className={styles.sectionLabel}>AI / LLM</h2>
                <AISwitchCard />
                <AssistantConnection model={model} />
              </section>
              <section className={styles.section} id="codex">
                <h2 className={styles.sectionLabel}>Codex</h2>
                <CodexSection />
              </section>
              <AdvancedSection model={model} />
            </>
          )}

          <section className={styles.section} id="backups">
            <h2 className={styles.sectionLabel}>Backups</h2>
            <BackupDefaultsCard />
            <DatabaseBackupCard isAdmin={!!user?.is_admin} />
          </section>
          <AutomaticWorkSection />
          <section className={styles.section} id="privacy">
            <h2 className={styles.sectionLabel}>Privacy</h2>
            <PrivacySection />
          </section>
          <section className={styles.section} id="about">
            <h2 className={styles.sectionLabel}>About and updates</h2>
            <AboutSection />
          </section>

          <section className={styles.section} id="account">
            <h2 className={styles.sectionLabel}>Account</h2>
            <div className={styles.card}>
              <p className={styles.accountName}>{user?.display_name}</p>
              <p className={styles.accountUsername}>@{user?.username}</p>
              {user?.is_admin && <span className={styles.adminBadge}>Admin</span>}
            </div>
            <ExampleStoriesCard />
          </section>
        </main>
      </div>
    </div>
  );
}
