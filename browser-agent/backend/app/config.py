from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM primário: Gemini (AX tree → ação estruturada)
    google_api_key: str = ""

    # LLM fallback: Claude Computer Use (screenshot → coordenadas)
    anthropic_api_key: str = ""

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    log_level: str = "info"

    # Quantas falhas consecutivas de ação antes de acionar computer use
    computer_use_fallback_threshold: int = 3


settings = Settings()
