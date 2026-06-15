from __future__ import annotations
import asyncio
from fastapi import WebSocket
from typing import Optional


class Session:
    def __init__(self, session_id: str, ws: WebSocket):
        self.session_id = session_id
        self.ws = ws
        self.task_id: Optional[str] = None
        self.task_objective: Optional[str] = None
        self.is_alive = True

    async def send(self, data: dict) -> None:
        try:
            await self.ws.send_json(data)
        except Exception:
            self.is_alive = False


class SessionManager:
    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()

    async def connect(self, session_id: str, ws: WebSocket) -> Session:
        await ws.accept()
        async with self._lock:
            session = Session(session_id, ws)
            self._sessions[session_id] = session
        return session

    async def disconnect(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)

    def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    @property
    def count(self) -> int:
        return len(self._sessions)


manager = SessionManager()
