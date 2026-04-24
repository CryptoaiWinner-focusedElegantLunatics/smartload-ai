from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # --- DODAJ TO POLE ---
    # Pydantic najpierw sprawdzi, czy w Railway jest zmienna DATABASE_URL
    DATABASE_URL: Optional[str] = None

    # Pozostałe zmienne (zostawiamy jako fallback)
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
    def get_db_url(self) -> str:
        # Jeśli Railway podał gotowy link, użyj go!
        if self.DATABASE_URL:
            # Mała poprawka dla SQLAlchemy, o której rozmawialiśmy
            if self.DATABASE_URL.startswith("postgres://"):
                return self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
            return self.DATABASE_URL
        
        # Jeśli nie ma gotowego linku, złóż go z części
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()