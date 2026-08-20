from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "pathseeker"
    clerk_jwks_url: str = ""
    clerk_secret_key: str = ""
    openai_api_key: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    dev_auth_bypass: bool = True
    dev_user_id: str = "dev-user"
    dev_user_email: str = "dev@example.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
