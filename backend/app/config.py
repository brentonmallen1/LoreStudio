from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in project root (parent of backend/)
_env_path = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_path), env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/lorestudio.db"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 10080  # 7 days

    admin_username: str = "admin"
    admin_password: str = "change-me"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4"
    ollama_temperature: float = 1.0
    ollama_top_p: float = 0.95
    ollama_top_k: int = 64
    ollama_keep_alive: str = "10m"
    ollama_thinking_enabled: bool = False


settings = Settings()
