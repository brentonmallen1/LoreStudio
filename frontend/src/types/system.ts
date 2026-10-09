// System status returned by /api/system/status (Settings › Backups).
export interface DbBackupInfo {
  filename: string;
  created_at: string;
  size_bytes: number;
}

export interface SystemStatus {
  version: string;
  env: string;
  database: { backend: string; revision: string | null; foreign_keys: boolean | null };
  backups: {
    enabled: boolean;
    path: string;
    keep: number;
    /** How often it runs, from Settings › Automatic work. */
    every_hours?: number;
    count: number;
    latest: DbBackupInfo | null;
  };
  insecure_defaults: string[];
}

/** /api/system/update: the version running and the latest release last seen (Settings › About). */
export interface UpdateStatus {
  current: string;
  latest: string | null;
  available: boolean;
  url: string | null;
  published_at: string | null;
  checked_at: string | null;
  error: string | null;
  /** How this LoreStudio was installed, for how to update it. */
  install: "docker" | "desktop" | "source";
  /** Whether the daily check (Settings › Automatic work) is on. */
  automatic: boolean;
}
