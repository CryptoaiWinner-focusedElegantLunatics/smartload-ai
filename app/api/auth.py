from fastapi import APIRouter, Request, Form, Depends, status
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import (
    verify_password, create_access_token,
    get_current_user, cookie_kwargs, _IS_PRODUCTION
)
from app.models.user import User


router = APIRouter(tags=["auth"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/login")
def render_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@router.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...)
):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user or not verify_password(password, user.hashed_password):
            return JSONResponse(
                status_code=401,
                content={"detail": "Nieprawidłowy login lub hasło."}
            )

        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        access_token = create_access_token(data={"sub": user.username, "role": role_str})

        response = JSONResponse(content={"ok": True, "role": role_str})
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            **cookie_kwargs()
        )
        return response


@router.post("/api/logout")
def logout():
    response = JSONResponse(content={"status": "success"})
    # ✅ Parametry muszą być identyczne jak przy set_cookie
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=_IS_PRODUCTION,
        samesite="none" if _IS_PRODUCTION else "lax",
        path="/",
    )
    return response


@router.get("/api/me")
def get_me(user: User = Depends(get_current_user)):
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    return {
        "id": user.id,
        "username": user.username,
        "role": role_str,
        "vehicle_plate": user.vehicle_plate,
    }