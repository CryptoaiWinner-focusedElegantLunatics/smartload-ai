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
    try:
        while True:
            data = await websocket.receive_text()

            from app.services.chat_bot import process_driver_message
            loop = asyncio.get_event_loop()
            with Session(engine) as db_session:
                response = await loop.run_in_executor(
                    None,
                    lambda: process_driver_message(data, db_session, session_id),
                )

            await ws_manager.send_text(websocket, response)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        ws_manager.disconnect(websocket)
