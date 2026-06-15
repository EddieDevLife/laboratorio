import json
import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..session.manager import manager
from ..models.accessibility import PageSnapshot
from ..models.actions import ActionResult
from ..agent.orchestrator import Orchestrator

logger = logging.getLogger(__name__)
router = APIRouter()

# Mapa session_id → Orchestrator (um por conexão WebSocket ativa)
_orchestrators: dict[str, Orchestrator] = {}

# Screenshot pendente por sessão (aguardando antes de chamar Computer Use)
_pending_screenshots: dict[str, str] = {}


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    session = await manager.connect(session_id, ws)
    logger.info(f"Sessão conectada: {session_id} (total: {manager.count})")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await session.send({"type": "error", "payload": {"error": "JSON inválido"}})
                continue

            msg_type = data.get("type")
            logger.debug(f"[{session_id}] ← {msg_type}")

            # ── ping/pong ──────────────────────────────────────────────────────
            if msg_type == "ping":
                await session.send({"type": "pong"})

            # ── Início de tarefa ───────────────────────────────────────────────
            elif msg_type == "task_start":
                task = data.get("payload", {})
                task_id = task.get("taskId") or str(uuid.uuid4())
                objective = task.get("objective", "Interagir com a página")

                session.task_id = task_id
                session.task_objective = objective

                # Cria orchestrator dedicado a esta tarefa
                _orchestrators[session_id] = Orchestrator(
                    session_id=session_id,
                    objective=objective,
                    task_id=task_id,
                )
                _pending_screenshots.pop(session_id, None)

                logger.info(f"[{session_id}] Tarefa iniciada: '{objective}'")
                await session.send({"type": "request_snapshot"})

            # ── Snapshot recebido da extensão ──────────────────────────────────
            elif msg_type == "snapshot":
                orch = _orchestrators.get(session_id)
                if not orch:
                    # Sem tarefa ativa → usa modo de escaneamento simples (mock)
                    snapshot = PageSnapshot(**data["payload"])
                    await session.send({
                        "type": "action_plan",
                        "payload": _scan_only_plan(snapshot).model_dump(),
                    })
                    continue

                snapshot = PageSnapshot(**data["payload"])
                screenshot = _pending_screenshots.pop(session_id, None)

                plan = await orch.on_snapshot(snapshot, screenshot_b64=screenshot)
                logger.info(
                    f"[{session_id}] Plano gerado: "
                    f"{len(plan.actions)} ação(ões) via "
                    f"{'computer_use' if any(a.reasoning and '[Computer Use]' in a.reasoning for a in plan.actions) else 'gemini'}"
                )
                await session.send({"type": "action_plan", "payload": plan.model_dump()})

                if orch.is_done():
                    await session.send({
                        "type": "task_complete",
                        "payload": {
                            "taskId": orch.task_id,
                            "summary": plan.actions[0].reasoning or "Tarefa concluída",
                        },
                    })
                    _orchestrators.pop(session_id, None)

            # ── Resultado de ação recebido da extensão ─────────────────────────
            elif msg_type == "action_result":
                orch = _orchestrators.get(session_id)
                if orch:
                    result = ActionResult(**data["payload"])
                    orch.on_action_result(result)
                    logger.info(
                        f"[{session_id}] Resultado: success={result.success} "
                        f"failures_consec={orch.consecutive_failures}"
                    )

                    if result.success and result.newSnapshotAvailable:
                        # Pede novo snapshot para continuar o loop
                        await session.send({"type": "request_snapshot"})
                    elif not result.success:
                        threshold = orch.consecutive_failures >= 3
                        if threshold:
                            # Pede screenshot para acionar Computer Use
                            logger.info(f"[{session_id}] {orch.consecutive_failures} falhas → pedindo screenshot")
                            await session.send({
                                "type": "request_screenshot",
                                "payload": {"reason": "Muitas falhas consecutivas — mudando para computer use"},
                            })
                        else:
                            # Tenta novamente com novo snapshot
                            await session.send({"type": "request_snapshot"})

            # ── Screenshot recebido da extensão ───────────────────────────────
            elif msg_type == "screenshot":
                payload = data.get("payload", {})
                b64 = payload.get("imageBase64", "")
                if b64:
                    _pending_screenshots[session_id] = b64
                    logger.info(f"[{session_id}] Screenshot recebido ({len(b64)//1024}KB)")
                    # Pede snapshot para acionar o Computer Use no próximo on_snapshot
                    await session.send({"type": "request_snapshot"})

            # ── Cancelamento ───────────────────────────────────────────────────
            elif msg_type == "task_cancel":
                _orchestrators.pop(session_id, None)
                _pending_screenshots.pop(session_id, None)
                logger.info(f"[{session_id}] Tarefa cancelada")

            else:
                logger.warning(f"[{session_id}] Tipo desconhecido: {msg_type}")

    except WebSocketDisconnect:
        logger.info(f"Sessão desconectada: {session_id}")
    finally:
        _orchestrators.pop(session_id, None)
        _pending_screenshots.pop(session_id, None)
        await manager.disconnect(session_id)


def _scan_only_plan(snapshot: PageSnapshot):
    """Plano mock para quando snapshot chega sem tarefa ativa (modo scan)."""
    from ..models.actions import Action, ActionPlan
    return ActionPlan(
        planId=str(uuid.uuid4()),
        taskId="scan",
        actions=[Action(
            actionId=str(uuid.uuid4()),
            snapshotId=snapshot.snapshotId,
            type="done",
            reasoning=f"Snapshot recebido: {snapshot.url} — {snapshot.source}",
            confidence=1.0,
        )],
        autonomyLevel="reactive",
        requiresConfirmation=False,
    )
