import asyncio
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
            
            try:
                # TUTAJ BYŁ BŁĄD - teraz wywołujemy to asynchronicznie bez żadnych executorów
                with Session(engine) as db_session:
                    response = await process_driver_message(data, db_session, session_id)
                
                print(f"✅ [AI WS] AI odpowiedziało poprawnie")
            except Exception as ai_err:
                print(f"🔥 [AI WS] Błąd wewnątrz funkcji AI: {ai_err}")
                response = '{"text": "Błąd: serwer AI nie odpowiedział.", "isHtml": false}'
            
            await ws_manager.send_text(websocket, response)
    except WebSocketDisconnect:
        print("🔌 [AI WS] Klient się rozłączył (Disconnect)")
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ [AI WS] WebSocket FATAL error: {e}")
        ws_manager.disconnect(websocket)
