from datetime import datetime, timedelta
from typing import Optional

from fastapi import Request, HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
def _get_secret() -> str:
    from app.core.config import settings
    return getattr(settings, "SECRET_KEY", "SUPER_SECRET_SMARTLOAD_KEY_CHANGE_ME_IN_PROD")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  

# ──────────────────────────────────────────────
# Password hashing (bcrypt)
# ──────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# ──────────────────────────────────────────────
# JWT Token
# ──────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_secret(), algorithm=ALGORITHM)

# ──────────────────────────────────────────────
# Dependency: get_current_user
# ──────────────────────────────────────────────
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
