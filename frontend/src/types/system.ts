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
  backups: { enabled: boolean; path: string; keep: number; count: number; latest: DbBackupInfo | null };
  insecure_defaults: string[];
}
