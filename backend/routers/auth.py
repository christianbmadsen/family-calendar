import hashlib
import jwt
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from firebase import db
from models.user import User, UserPublic
from dependencies import get_current_user
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Password hashing (built-in hashlib.scrypt — no extra dependency)
# ---------------------------------------------------------------------------

_PBKDF2_ITERATIONS = 260_000


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return salt.hex() + ":" + key.hex()


def _verify_password(password: str, hashed: str) -> bool:
    salt_hex, key_hex = hashed.split(":", 1)
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return secrets.compare_digest(key.hex(), key_hex)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserPublic
    is_new_user: bool


# ---------------------------------------------------------------------------
# Email / password endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest):
    existing = db.collection("users").where("email", "==", body.email).limit(1).get()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user_data = {
        "id": user_id,
        "email": body.email,
        "name": body.name or body.email.split("@")[0],
        "photo_url": None,
        "family_id": None,
        "push_tokens": [],
        "notify_push": True,
        "notify_email": True,
        "google_calendar_id": None,
        "google_refresh_token": None,
        "password_hash": _hash_password(body.password),
        "created_at": now,
    }
    db.collection("users").document(user_id).set(user_data)

    return AuthResponse(
        access_token=_create_access_token(user_id),
        user=UserPublic(**user_data),
        is_new_user=True,
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    docs = db.collection("users").where("email", "==", body.email).limit(1).get()
    if not docs:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_data = docs[0].to_dict()
    password_hash = user_data.get("password_hash")

    if not password_hash or not _verify_password(body.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        access_token=_create_access_token(user_data["id"]),
        user=UserPublic(**user_data),
        is_new_user=False,
    )


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)):
    return UserPublic(**user.model_dump())


@router.post("/logout", status_code=204)
def logout():
    return


# ---------------------------------------------------------------------------
# Google OAuth — only active when credentials are configured
# ---------------------------------------------------------------------------

if settings.google_client_id and settings.google_client_secret:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    from google_auth_oauthlib.flow import Flow

    GOOGLE_SCOPES = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar",
    ]

    class GoogleAuthRequest(BaseModel):
        auth_code: str
        redirect_uri: str = "postmessage"

    def _build_flow() -> Flow:
        config = {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }
        flow = Flow.from_client_config(config, scopes=GOOGLE_SCOPES)
        flow.redirect_uri = settings.google_redirect_uri
        return flow

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
        if credentials.refresh_token:
            updates["google_refresh_token"] = credentials.refresh_token

        if is_new_user:
            user_data = {
                "id": user_id,
                "email": idinfo["email"],
                "family_id": None,
                "push_tokens": [],
                "notify_push": True,
                "notify_email": True,
                "google_calendar_id": None,
                "google_refresh_token": credentials.refresh_token,
                "password_hash": None,
                "created_at": now,
                **updates,
            }
            user_ref.set(user_data)
        else:
            user_ref.update(updates)
            user_data = {**doc.to_dict(), **updates}
            if credentials.refresh_token:
                user_data["google_refresh_token"] = credentials.refresh_token

        return AuthResponse(
            access_token=_create_access_token(user_id),
            user=UserPublic(**user_data),
            is_new_user=is_new_user,
        )
