import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session
from app.core.database import engine

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_text(self, websocket: WebSocket, message: str):
        await websocket.send_text(message)


ws_manager = ConnectionManager()


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    session_id = websocket.client.host if websocket.client else "anonymous"

    # Wyciągnij driver_id z tokena (cookie httponly LUB query param)
    driver_id = None
    try:
        from jose import jwt as jose_jwt, JWTError
        from app.core.security import _get_secret, ALGORITHM
        from sqlmodel import select
        from app.models.user import User

        # 1) Spróbuj z cookie (httponly — ustawiane przez /login)
        token = websocket.cookies.get("access_token") or ""
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1]

        # 2) Fallback: query param (?token=xxx)
        if not token:
            token = websocket.query_params.get("token") or ""

        if token:
            payload = jose_jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username:
                with Session(engine) as s:
                    user = s.exec(select(User).where(User.username == username)).first()
                    if user:
                        driver_id = user.id
                        session_id = f"user_{user.id}"
    except Exception as e:
        print(f"⚠️ [AI WS] Token decode failed: {e}")

    print(f"🔌 [AI WS] Otwarto połączenie dla: {session_id} (driver_id={driver_id})")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📥 [AI WS] Otrzymałem: {data}")

            from app.services.chat_bot import process_driver_message

            with Session(engine) as db_session:
                response = await process_driver_message(data, db_session, session_id, driver_id=driver_id)

            print(f"🔍 [AI WS] DEBUG WYNIKU: Typ: {type(response)} | Treść: {response}")

            if response is None:
                response = '{"text": "Nie znalazłem żadnych ofert dla tego miasta.", "isHtml": false}'

            # Upewnij się, że to jest string przed wysyłką
            if not isinstance(response, str):
                response = json.dumps(response, ensure_ascii=False, default=str)

            await ws_manager.send_text(websocket, response)
            print("📤 [AI WS] Odpowiedź wysłana do Reacta!")

    except WebSocketDisconnect:
        print(f"🔌 [AI WS] Rozłączono: {session_id}")
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"🔥 [AI WS] FATAL ERROR: {e}")
        ws_manager.disconnect(websocket)
