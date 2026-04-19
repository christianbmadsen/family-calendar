from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str = "postmessage"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    gmail_address: str
    gmail_app_password: str

    db_path: str = "./family_calendar.db"

    class Config:
        env_file = ".env"


settings = Settings()
