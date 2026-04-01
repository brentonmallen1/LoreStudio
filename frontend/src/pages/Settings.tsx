import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import styles from "./Settings.module.css";

type Theme = "light" | "dark" | "system";

const OLLAMA_URL_KEY = "ls_ollama_url";
const OLLAMA_MODEL_KEY = "ls_ollama_model";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();
  const { user } = useAuthStore();
  const [ollamaUrl, setOllamaUrl] = useState(localStorage.getItem(OLLAMA_URL_KEY) ?? "http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem(OLLAMA_MODEL_KEY) ?? "llama3.2");
  const [saved, setSaved] = useState(false);

  function saveOllamaConfig() {
    localStorage.setItem(OLLAMA_URL_KEY, ollamaUrl);
    localStorage.setItem(OLLAMA_MODEL_KEY, ollamaModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const themes: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ArrowLeft size={16} />
        </button>
        <span className={styles.topbarTitle}>Settings</span>
      </header>

      <main className={styles.main}>
        {/* Theme */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Appearance</h2>
          <div className={styles.themeRow}>
            {themes.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`${styles.themeOption} ${theme === value ? styles.active : ""}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* LLM Config */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>AI / LLM</h2>
          <div className={styles.card}>
            <div className={styles.field}>
              <label className={styles.label}>Ollama URL</label>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Model</label>
              <input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className={styles.input}
              />
            </div>
            <button onClick={saveOllamaConfig} className={styles.saveBtn}>
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </section>

        {/* Account */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Account</h2>
          <div className={styles.card}>
            <p className={styles.accountName}>{user?.display_name}</p>
            <p className={styles.accountUsername}>@{user?.username}</p>
            {user?.is_admin && (
              <span className={styles.adminBadge}>Admin</span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
