import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase import db
from models.user import User
from models.family import Family
from config import settings

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=401, detail="User not found")

    return User(**doc.to_dict())


def get_current_family(user: User = Depends(get_current_user)) -> tuple[User, Family]:
    if not user.family_id:
        raise HTTPException(status_code=400, detail="User is not a member of any family")

    doc = db.collection("families").document(user.family_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Family not found")

    return user, Family(**doc.to_dict())
