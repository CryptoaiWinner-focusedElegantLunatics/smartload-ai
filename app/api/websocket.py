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

    print(f"🔌 [AI WS] Otwarto połączenie dla: {session_id}")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📥 [AI WS] Otrzymałem: {data}")

            from app.services.chat_bot import process_driver_message

            print("⏳ [AI WS] Uruchamiam process_driver_message...")

            # process_driver_message jest async (await _generate_cmr → asyncio.to_thread).
            # Wywołujemy bezpośrednio — NIE przez run_in_executor,
            # bo asyncio.run() w wątku powoduje deadlock z zagnieżdżonymi event loopami.
            with Session(engine) as db_session:
                response = await process_driver_message(data, db_session, session_id)

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
