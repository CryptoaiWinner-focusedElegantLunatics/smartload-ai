from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(tags=["views"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
def render_landing(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})


@router.get("/dashboard")
def render_main_dashboard(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("dashboard_main.html", {"request": request})


@router.get("/mail")
def render_mail(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("mail.html", {"request": request})


@router.get("/compare")
def render_compare(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("compare.html", {"request": request})


@router.get("/chat")
def render_chat(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("chat.html", {"request": request})
