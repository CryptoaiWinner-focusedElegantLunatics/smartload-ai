"""
Czat user-to-user oparty na Pusher Channels (zamiast raw WebSocket).
Wysyłanie: POST /api/chat/send → zapis w DB + Pusher trigger.
Odbieranie: frontend subskrybuje private-user-{id} i dostaje eventy.
Autoryzacja: POST /api/pusher/auth (Pusher wymaga tego dla private channels).
AI Bot (/ws/chat) pozostaje w websocket.py.
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import RoleChecker, _get_secret, ALGORITHM
from app.core.pusher_client import pusher_client
from app.models.user import User, UserRole
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


# ─── Schematy ─────────────────────────────────────────────────────────────────
class ContactOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    timestamp: datetime
    is_read: bool

    class Config:
        from_attributes = True


class SendMessageIn(BaseModel):
    receiver_id: int
    content: str


# ─── POST /api/chat/send — wysyłanie wiadomości ──────────────────────────────
@router.post("/api/chat/send", response_model=MessageOut)
def send_message(
    body: SendMessageIn,
    current_user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR", "KIEROWCA"])),
):
    """
    Zapisuje wiadomość w bazie i wysyła Pusher event do odbiorcy.
    Nadawca dostaje odpowiedź HTTP z zapisaną wiadomością (zawiera DB id + timestamp).
    """
    content = body.content.strip()
    if not content:
        raise HTTPException(400, "Treść wiadomości nie może być pusta")

    with Session(engine) as session:
        msg = ChatMessage(
            sender_id=current_user.id,
            receiver_id=body.receiver_id,
            content=content,
        )
        session.add(msg)
        session.commit()
        session.refresh(msg)

        payload = {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat(),
            "is_read": msg.is_read,
        }

    # Pusher: wyślij event na kanał ODBIORCY
    try:
        pusher_client.trigger(
            f"private-user-{body.receiver_id}",
            "new-message",
            payload,
        )
        # Opcjonalnie: echo na kanale NADAWCY (żeby inne karty/urządzenia zobaczyły)
        pusher_client.trigger(
            f"private-user-{current_user.id}",
            "message-sent",
            payload,
        )
        logger.info(f"[Pusher] MSG #{msg.id} | {current_user.id}→{body.receiver_id} ✓")
    except Exception as e:
        logger.error(f"[Pusher] Błąd trigger: {e}")
        # Wiadomość jest już w bazie — nie rzucamy 500, frontend dostanie ją z historii

    return MessageOut(**payload)


# ─── POST /api/pusher/auth — autoryzacja private channels ────────────────────
@router.post("/api/pusher/auth")
async def pusher_auth(request: Request):
    """
    Pusher JS client automatycznie wysyła POST tutaj gdy subskrybuje private-*.
    Sprawdzamy czy user jest zalogowany i czy kanał pasuje do jego ID.
    """
    from jose import jwt as jose_jwt, JWTError

    # Parsuj body (Pusher wysyła form-encoded)
    form = await request.form()
    socket_id = form.get("socket_id")
    channel_name = form.get("channel_name")

    if not socket_id or not channel_name:
        raise HTTPException(400, "Brak socket_id lub channel_name")

    # Autentykacja — z ciasteczka access_token
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(403, "Brak tokena autoryzacji")

    if token.lower().startswith("bearer "):
        token = token.split(" ", 1)[1]

    try:
        payload = jose_jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(403, "Nieprawidłowy token")
    except JWTError:
        raise HTTPException(403, "Nieprawidłowy token")

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            raise HTTPException(403, "Użytkownik nie istnieje")

    # Sprawdź czy kanał należy do tego usera
    expected_channel = f"private-user-{user.id}"
    if channel_name != expected_channel:
        logger.warning(f"[Pusher Auth] User {user.id} próbuje subskrybować {channel_name} (oczekiwano {expected_channel})")
        raise HTTPException(403, "Brak dostępu do tego kanału")

    # Generuj podpis Pusher
    auth_response = pusher_client.authenticate(
        channel=channel_name,
        socket_id=socket_id,
    )
    return auth_response


# ─── REST: Historia konwersacji ───────────────────────────────────────────────
@router.get("/api/chat/history/{contact_id}", response_model=list[MessageOut])
def get_chat_history(
    contact_id: int,
    current_user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR", "KIEROWCA"])),
):
    """Pobiera historię wiadomości między zalogowanym użytkownikiem a contact_id."""
    with Session(engine) as session:
        msgs = session.exec(
            select(ChatMessage)
            .where(
                ((ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == contact_id))
                | ((ChatMessage.sender_id == contact_id) & (ChatMessage.receiver_id == current_user.id))
            )
            .order_by(ChatMessage.timestamp)
        ).all()

        # Oznacz wiadomości wysłane do nas jako przeczytane
        for m in msgs:
            if m.receiver_id == current_user.id and not m.is_read:
                m.is_read = True
        session.commit()

        result = [
            MessageOut(
                id=m.id,
                sender_id=m.sender_id,
                receiver_id=m.receiver_id,
                content=m.content,
                timestamp=m.timestamp,
                is_read=m.is_read,
            )
            for m in msgs
        ]

    return result


# ─── REST: Lista kontaktów ────────────────────────────────────────────────────
@router.get("/api/chat/contacts", response_model=list[ContactOut])
def get_chat_contacts(
    current_user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR", "KIEROWCA"])),
):
    """
    SPEDYTOR/ADMIN → zwraca listę KIEROWCÓW.
    KIEROWCA → zwraca listę SPEDYTORÓW + ADMINÓW.
    """
    with Session(engine) as session:
        if current_user.role in (UserRole.ADMIN, UserRole.SPEDYTOR):
            contacts = session.exec(
                select(User).where(User.role == UserRole.KIEROWCA)
            ).all()
        else:
            contacts = session.exec(
                select(User).where(User.role.in_([UserRole.SPEDYTOR, UserRole.ADMIN]))  # type: ignore[attr-defined]
            ).all()
    return contacts
