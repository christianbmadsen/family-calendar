from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    firebase_project_id: str
    firebase_credentials_path: str

    google_cloud_project: str
    vertex_ai_location: str = "us-east5"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    gmail_address: str
    gmail_app_password: str

    ticketmaster_api_key: str
    amadeus_client_id: str
    amadeus_client_secret: str

    class Config:
        env_file = ".env"


settings = Settings()
