"""
Moduł czatu user-to-user: WebSocket ConnectionManager + endpointy REST.
Stary bot AI (/ws/chat) pozostaje w websocket.py — ten moduł obsługuje /ws/user-chat.
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import _get_secret, ALGORITHM
from app.models.user import User, UserRole
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


# ─── ConnectionManager ────────────────────────────────────────────────────────
class UserConnectionManager:
    """
    Przechowuje mapowanie user_id → WebSocket.
    Jeden użytkownik = jedno aktywne połączenie (nowe zastępuje stare).
    """

    def __init__(self):
        self.active: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        # Jeśli stare połączenie istnieje, zamknij je
        if user_id in self.active:
            try:
                await self.active[user_id].close()
            except Exception:
                pass
        self.active[user_id] = websocket
        logger.info(f"🔌 [Chat] User {user_id} połączony. Online: {list(self.active.keys())}")

    def disconnect(self, user_id: int):
        self.active.pop(user_id, None)
        logger.info(f"🔌 [Chat] User {user_id} rozłączony. Online: {list(self.active.keys())}")

    async def send_to_user(self, user_id: int, payload: dict):
        ws = self.active.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload, ensure_ascii=False, default=str))
            except Exception as e:
                logger.warning(f"⚠️ Nie można wysłać do user {user_id}: {e}")
                self.disconnect(user_id)

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active


chat_manager = UserConnectionManager()


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


# ─── Helper: wyciągnij usera z cookie WebSocketa ─────────────────────────────
def _get_user_from_ws_cookie(websocket: WebSocket) -> User | None:
    """Odczytuje access_token z cookie WS handshake i zwraca usera."""
    from jose import jwt as jose_jwt, JWTError

    token_cookie = websocket.cookies.get("access_token")
    if not token_cookie:
        return None

    try:
        scheme, _, token = token_cookie.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        payload = jose_jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            return None
    except JWTError:
        return None

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
    return user


# ─── WebSocket endpoint ───────────────────────────────────────────────────────
@router.websocket("/ws/user-chat")
async def user_chat_ws(websocket: WebSocket):
    """
    WebSocket dla czatu user-to-user.
    Autentykacja przez cookie access_token (przy WS handshake przeglądarka
    automatycznie wysyła cookies — nawet httponly).
    Wiadomości mają format: {"receiver_id": 5, "content": "Cześć!"}
    """
    # ── Autoryzacja z cookie ──
    await websocket.accept()

    user = _get_user_from_ws_cookie(websocket)
    if not user:
        await websocket.send_text(json.dumps({"type": "error", "message": "Brak autoryzacji"}))
        await websocket.close(code=1008, reason="Brak autoryzacji")
        return

    current_user_id = user.id
    await chat_manager.connect(current_user_id, websocket)

    # Poinformuj klienta o połączeniu
    await websocket.send_text(json.dumps({
        "type": "connected",
        "user_id": current_user_id,
        "username": user.username,
        "message": "Połączono z czatem.",
    }))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                # ── Parsuj JSON ──
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError as e:
                    logger.warning(f"[WS:{current_user_id}] Zły JSON: {e} | raw={raw!r}")
                    await websocket.send_text(json.dumps({"type": "error", "message": "Nieprawidłowy format JSON"}))
                    continue

                receiver_id = data.get("receiver_id")
                content = (data.get("content") or "").strip()

                if not receiver_id or not content:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Wymagane pola: receiver_id (int), content (str)"}))
                    continue

                receiver_id = int(receiver_id)  # konwertuj na int na wypadek stringa

                # ── Zapis do bazy (PRZED broadcastem) ──
                with Session(engine) as session:
                    msg = ChatMessage(
                        sender_id=current_user_id,   # zawsze z autoryzacji, nie z frontendu
                        receiver_id=receiver_id,
                        content=content,
                    )
                    session.add(msg)
                    session.commit()
                    session.refresh(msg)

                    msg_payload = {
                        "type": "message",
                        "id": msg.id,
                        "sender_id": msg.sender_id,
                        "receiver_id": msg.receiver_id,
                        "content": msg.content,
                        "timestamp": msg.timestamp.isoformat(),
                        "is_read": msg.is_read,
                    }

                logger.info(f"[WS] MSG #{msg_payload['id']} | {current_user_id}→{receiver_id} | saved ✓")

                # ── Broadcast do odbiorcy ──
                await chat_manager.send_to_user(receiver_id, msg_payload)
                # ── Echo z type="sent" do nadawcy (zawiera prawdziwe DB id) ──
                await websocket.send_text(json.dumps({**msg_payload, "type": "sent"}))

            except Exception as loop_err:
                logger.error(f"[WS:{current_user_id}] Błąd w pętli: {loop_err}", exc_info=True)
                try:
                    await websocket.send_text(json.dumps({"type": "error", "message": f"Błąd serwera: {loop_err}"}))
                except Exception:
                    pass  # websocket może być już zamknięty

    except WebSocketDisconnect:
        chat_manager.disconnect(current_user_id)
    except Exception as e:
        logger.error(f"❌ WS user-chat fatal error: {e}", exc_info=True)
        chat_manager.disconnect(current_user_id)


# ─── REST: Historia konwersacji ───────────────────────────────────────────────
from app.core.security import RoleChecker


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

        # WAŻNE: konwertuj na Pydantic WEWNĄTRZ bloku with,
        # zanim sesja się zamknie — inaczej DetachedInstanceError
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
