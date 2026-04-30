from datetime import datetime, timedelta
from typing import Optional, List
import os

from fastapi import Request, HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select


def _get_secret() -> str:
    from app.core.config import settings
    return getattr(settings, "SECRET_KEY", "SUPER_SECRET_SMARTLOAD_KEY_CHANGE_ME_IN_PROD")


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8h ważność JWT

_IS_PRODUCTION = os.getenv("RAILWAY_ENVIRONMENT") is not None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_secret(), algorithm=ALGORITHM)


def cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": _IS_PRODUCTION,
        "samesite": "none" if _IS_PRODUCTION else "lax",
        # ✅ BRAK max_age i expires → session cookie
        # Przeglądarka usuwa je automatycznie przy zamknięciu okna/karty
        "path": "/",
    }


def get_current_user(request: Request):
    from app.models.user import User
    from app.core.database import engine

    _redirect = HTTPException(
        status_code=303,
        detail="Wymagane logowanie",
        headers={"Location": "/login"},
    )

    token_cookie: Optional[str] = request.cookies.get("access_token")
    if not token_cookie:
        raise _redirect

    try:
        scheme, _, token = token_cookie.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise _redirect
        payload = jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if not username:
            raise _redirect
    except JWTError:
        raise _redirect

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()

    if user is None:
        raise _redirect

    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, request: Request):
        user = get_current_user(request)
        user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role_str not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Brak uprawnień. Wymagana rola: {', '.join(self.allowed_roles)}.",
            )
        return user