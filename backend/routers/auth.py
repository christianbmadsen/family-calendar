import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_auth_oauthlib.flow import Flow
from firebase import db
from models.user import User
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar",
]

_CLIENT_CONFIG = {
    "web": {
        "client_id": None,       # filled at request time from settings
        "client_secret": None,
        "redirect_uris": [],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}


class GoogleAuthRequest(BaseModel):
    auth_code: str
    redirect_uri: str = "postmessage"  # web default; mobile passes its Expo redirect URI


class AuthResponse(BaseModel):
    access_token: str
    user: User
    is_new_user: bool


def _build_flow() -> Flow:
    config = {
        "web": {
            **_CLIENT_CONFIG["web"],
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    flow = Flow.from_client_config(config, scopes=GOOGLE_SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


@router.post("/google", response_model=AuthResponse)
def google_auth(body: GoogleAuthRequest):
    flow = _build_flow()
    flow.redirect_uri = body.redirect_uri

    try:
        flow.fetch_token(code=body.auth_code)
    except Exception:
        raise HTTPException(status_code=401, detail="Failed to exchange authorization code")

    credentials = flow.credentials

    try:
        idinfo = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    user_id = idinfo["sub"]
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()
    is_new_user = not doc.exists

    now = datetime.now(timezone.utc)
    updates = {
        "name": idinfo.get("name", ""),
        "photo_url": idinfo.get("picture"),
    }

    # Only overwrite refresh token when Google issues a new one
    if credentials.refresh_token:
        updates["google_refresh_token"] = credentials.refresh_token

    if is_new_user:
        user_data = {
            "id": user_id,
            "email": idinfo["email"],
            "family_id": None,
            "phone_number": None,
            "push_tokens": [],
            "notify_push": True,
            "notify_sms": True,
            "google_calendar_id": None,
            "google_refresh_token": credentials.refresh_token,
            "created_at": now,
            **updates,
        }
        user_ref.set(user_data)
    else:
        user_ref.update(updates)
        user_data = {**doc.to_dict(), **updates}
        if credentials.refresh_token:
            user_data["google_refresh_token"] = credentials.refresh_token

    user = User(**user_data)
    token = _create_access_token(user_id)

    return AuthResponse(access_token=token, user=user, is_new_user=is_new_user)


@router.post("/logout", status_code=204)
def logout():
    return
