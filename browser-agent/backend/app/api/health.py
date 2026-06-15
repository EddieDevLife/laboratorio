from fastapi import APIRouter
from ..session.manager import manager

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "sessions": manager.count}
