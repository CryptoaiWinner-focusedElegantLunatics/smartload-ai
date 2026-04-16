from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""
    POSTGRES_HOST: str = ""
    POSTGRES_PORT: int = 5432

    OPENAI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_IMAP_SERVER: str = ""
    DEBUG: bool = True
    SECRET_KEY: str = "SUPER_SECRET_SMARTLOAD_KEY_CHANGE_ME"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"

settings = Settings()
