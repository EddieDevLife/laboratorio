"""
Orchestrator — loop observe → plan → act com fallback em cascata.

Fluxo:
  1. Recebe PageSnapshot da extensão (via WebSocket)
  2. Constrói contexto compacto com context_builder
  3. Chama GeminiAgent (AX tree → ação estruturada)
  4. Envia ActionPlan à extensão
  5. Recebe ActionResult; se falhou N vezes → aciona ComputerUseClient
  6. Repete até tipo "done" ou limite de passos

O Orchestrator é stateful por sessão — instancie um por conexão WebSocket.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional

from ..models.accessibility import PageSnapshot, AccessibilityNode
from ..models.actions import Action, ActionPlan, ActionResult
from ..config import settings
from .context_builder import build_context

logger = logging.getLogger(__name__)

MAX_STEPS = 30  # teto de segurança para evitar loop infinito


class Orchestrator:
    def __init__(self, session_id: str, objective: str, task_id: str):
        self.session_id = session_id
        self.objective = objective
        self.task_id = task_id

        # Histórico compacto: lista de {"step": N, "action": str, "result": str}
        self.history: list[dict] = []
        self.step = 0
        self.consecutive_failures = 0
        self.done = False

        # Lazy-init dos clientes LLM para não falhar se a chave não estiver configurada
        self._gemini: Optional[object] = None
        self._computer_use: Optional[object] = None
        self._index_map: dict[int, AccessibilityNode] = {}

        # Histórico de mensagens para o Computer Use (multi-turn)
        self._cu_history: list[dict] = []

    # ── Propriedades lazy ──────────────────────────────────────────────────────

    @property
    def gemini(self):
        if self._gemini is None:
            from ..llm.gemini_agent import GeminiAgent
            self._gemini = GeminiAgent()
        return self._gemini

    @property
    def computer_use(self):
        if self._computer_use is None:
            from ..llm.computer_use import ComputerUseClient
            self._computer_use = ComputerUseClient()
        return self._computer_use

    # ── API pública ────────────────────────────────────────────────────────────

    async def on_snapshot(
        self,
        snapshot: PageSnapshot,
        screenshot_b64: Optional[str] = None,
    ) -> ActionPlan:
        """
        Recebe um snapshot (e opcionalmente um screenshot) e devolve
        o próximo ActionPlan a ser executado pela extensão.
        """
        self.step += 1
        logger.info(
            f"[{self.session_id}] Step {self.step}/{MAX_STEPS} — "
            f"failures={self.consecutive_failures} url={snapshot.url}"
        )

        if self.step > MAX_STEPS:
            return self._done_plan("Limite de passos atingido.")

        # ── Caminho 1: GeminiAgent sobre a AX tree ─────────────────────────────
        use_computer_use = (
            self.consecutive_failures >= settings.computer_use_fallback_threshold
        )

        if not use_computer_use:
            try:
                context, self._index_map = build_context(snapshot)
                plan = await self._call_gemini(snapshot, context, screenshot_b64)
                if plan:
                    return plan
            except Exception as exc:
                logger.warning(f"[{self.session_id}] Gemini falhou: {exc}")

        # ── Caminho 2: Claude Computer Use sobre screenshot ────────────────────
        if screenshot_b64:
            try:
                return await self._call_computer_use(snapshot, screenshot_b64)
            except Exception as exc:
                logger.error(f"[{self.session_id}] Computer Use falhou: {exc}")
                return self._error_plan(str(exc))

        # Sem screenshot e Gemini falhou → pede screenshot
        return ActionPlan(
            planId=str(uuid.uuid4()),
            taskId=self.task_id,
            actions=[Action(
                actionId=str(uuid.uuid4()),
                snapshotId=snapshot.snapshotId,
                type="screenshot",
                reasoning="Precisamos do screenshot para continuar (AX tree insuficiente)",
                confidence=1.0,
            )],
            autonomyLevel="semi",
            requiresConfirmation=False,
        )

    def on_action_result(self, result: ActionResult) -> None:
        """Atualiza o histórico com o resultado da última ação."""
        status = "✓" if result.success else "✗"
        entry = {
            "step": self.step,
            "success": result.success,
            "error": result.error or "",
        }
        self.history.append(entry)

        if result.success:
            self.consecutive_failures = 0
            # Limpa histórico do computer use após sucesso (contexto fresco)
            if len(self._cu_history) > 6:
                self._cu_history = self._cu_history[-4:]
        else:
            self.consecutive_failures += 1
            logger.warning(
                f"[{self.session_id}] Falha #{self.consecutive_failures}: {result.error}"
            )

    def is_done(self) -> bool:
        return self.done

    # ── Internos ───────────────────────────────────────────────────────────────

    async def _call_gemini(
        self,
        snapshot: PageSnapshot,
        context: str,
        screenshot_b64: Optional[str],
    ) -> Optional[ActionPlan]:
        history_text = self._format_history()
        # Injeta histórico no contexto
        full_context = context
        if history_text:
            full_context = f"Previous steps:\n{history_text}\n\n{context}"

        plan = await self.gemini.analyze_and_plan(
            task_objective=self.objective,
            snapshot=snapshot,
            screenshot_base64=screenshot_b64,
        )

        if not plan or not plan.actions:
            return None

        first_action = plan.actions[0]
        if first_action.type == "done":
            self.done = True
            return self._done_plan(first_action.reasoning or "Tarefa concluída")

        # Resolve [index] → nodeId se Gemini retornou um índice numérico
        for action in plan.actions:
            if action.target and action.target.index is not None:
                node = self._index_map.get(action.target.index)
                if node:
                    action.target.nodeId = node.nodeId
                    action.target.name = node.name
                    action.target.role = node.role

        return ActionPlan(
            planId=str(uuid.uuid4()),
            taskId=self.task_id,
            actions=plan.actions,
            autonomyLevel="semi",
            requiresConfirmation=False,
        )

    async def _call_computer_use(
        self,
        snapshot: PageSnapshot,
        screenshot_b64: str,
    ) -> ActionPlan:
        logger.info(f"[{self.session_id}] Acionando Claude Computer Use")

        result = await asyncio.to_thread(
            self.computer_use.plan,
            objective=self.objective,
            screenshot_b64=screenshot_b64,
            snapshot_id=snapshot.snapshotId,
            url=snapshot.url,
            viewport_width=int(snapshot.viewportWidth) or 1280,
            viewport_height=int(snapshot.viewportHeight) or 800,
            history=self._cu_history or None,
        )

        if result.done:
            self.done = True

        # Acumula histórico multi-turn do computer use
        if result.thinking:
            self._cu_history.append({
                "role": "assistant",
                "content": [{"type": "text", "text": result.thinking}],
            })

        return self.computer_use.build_action_plan(result, self.task_id)

    def _format_history(self) -> str:
        if not self.history:
            return ""
        lines = []
        for h in self.history[-8:]:  # últimos 8 passos
            status = "OK" if h["success"] else f"FAIL({h['error']})"
            lines.append(f"Step {h['step']}: {status}")
        return "\n".join(lines)

    def _done_plan(self, summary: str) -> ActionPlan:
        self.done = True
        return ActionPlan(
            planId=str(uuid.uuid4()),
            taskId=self.task_id,
            actions=[Action(
                actionId=str(uuid.uuid4()),
                snapshotId="",
                type="done",
                reasoning=summary,
                confidence=1.0,
            )],
            autonomyLevel="full",
            requiresConfirmation=False,
        )

    def _error_plan(self, error: str) -> ActionPlan:
        return ActionPlan(
            planId=str(uuid.uuid4()),
            taskId=self.task_id,
            actions=[Action(
                actionId=str(uuid.uuid4()),
                snapshotId="",
                type="error",
                reasoning=f"Erro irrecuperável: {error}",
                confidence=0.0,
            )],
            autonomyLevel="reactive",
            requiresConfirmation=True,
        )
