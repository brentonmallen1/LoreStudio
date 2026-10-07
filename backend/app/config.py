from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in project root (parent of backend/)
_env_path = Path(__file__).resolve().parents[2] / ".env"

#: Values that must not reach a non-dev deployment. Checked at startup.
INSECURE_SECRET_KEYS = {"dev-secret-key-change-in-production", "dev-secret-key", "change-me", "secret", ""}
INSECURE_ADMIN_PASSWORDS = {"change-me", "changeme", "admin", "password", ""}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_path), env_file_encoding="utf-8", extra="ignore")

    # Environment: "dev" tolerates default secrets; anything else refuses them.
    env: str = "dev"
    #: The release (CalVer, "2026.10.1"), stamped into the image by the release build; "dev" otherwise.
    app_version: str = "dev"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./data/lorestudio.db"
    auto_migrate: bool = True
    snapshots_path: str = "./data/snapshots"
    uploads_path: str = "./data/uploads"
    backups_path: str = "./data/backups"
    db_backup_enabled: bool = True
    db_backup_keep: int = 14
    #: Days to keep AI prompts and responses. The summary of every call is kept forever;
    #: this only prunes the prose. 0 disables pruning.
    ai_payload_retention_days: int = 90

    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 10080  # 7 days
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    admin_username: str = "admin"
    admin_password: str = "change-me"

    # Demo content, seeded only into an empty database.
    seed_demo: bool = True
    seed_extra_demos: bool = False

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4"
    ollama_temperature: float = 1.0
    ollama_top_p: float = 0.95
    ollama_top_k: int = 64
    ollama_keep_alive: str = "10m"
    ollama_thinking_enabled: bool = False

    @property
    def is_dev(self) -> bool:
        return self.env.lower() in ("dev", "development", "local", "test")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def insecure_defaults(self) -> list[str]:
        """Names of secret settings still at a default value."""
        problems = []
        if self.secret_key in INSECURE_SECRET_KEYS:
            problems.append("SECRET_KEY")
        if self.admin_password in INSECURE_ADMIN_PASSWORDS:
            problems.append("ADMIN_PASSWORD")
        return problems


settings = Settings()
