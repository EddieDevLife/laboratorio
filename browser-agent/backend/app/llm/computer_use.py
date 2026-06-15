"""
Claude Computer Use — fallback de screenshot para ações por coordenada.

Quando a AX tree não é suficiente (elemento sem role/name, shadow DOM opaco,
canvas, CAPTCHA visual), tiramos um screenshot e deixamos o Claude decidir
onde clicar usando o Computer Use beta da Anthropic.

Ref: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any, Optional

import anthropic

from ..config import settings
from ..models.actions import Action, ActionPlan, ActionParams, ActionTarget

logger = logging.getLogger(__name__)

# Modelo recomendado para computer use
COMPUTER_USE_MODEL = "claude-opus-4-8"
BETA_HEADER = "computer-use-2025-01-24"


# ── Tool definitions (do computer-use-demo da Anthropic) ──────────────────────

def _make_computer_tool(width: int, height: int) -> dict:
    return {
        "type": "computer_20250124",
        "name": "computer",
        "display_width_px": width,
        "display_height_px": height,
    }


# ── Mapeamento de ações do Computer Use para nosso schema ─────────────────────
#
# Claude retorna tool_use com action in:
#   left_click, right_click, middle_click, double_click,
#   left_click_drag, type, key, screenshot, scroll,
#   cursor_position, mouse_move, wait
#
def _convert_cu_action(
    cu_input: dict[str, Any],
    snapshot_id: str,
) -> Action | None:
    """Converte um tool_use input do Computer Use para nosso Action schema."""
    action_type = cu_input.get("action")
    coordinate = cu_input.get("coordinate")  # [x, y]
    text = cu_input.get("text")
    key = cu_input.get("key")
    direction = cu_input.get("direction")
    amount = cu_input.get("amount", 3)

    if action_type == "screenshot":
        # Claude pediu um screenshot — tratamos como request e não como ação
        return None

    action_id = str(uuid.uuid4())

    if action_type in ("left_click", "right_click", "middle_click", "double_click"):
        button = "left"
        if action_type == "right_click":
            button = "right"
        elif action_type == "middle_click":
            button = "middle"

        target = None
        params = None
        if coordinate:
            x, y = coordinate
            target = ActionTarget(nodeId=None, role=None, name=None)
            # Guardamos coordenadas nos bounds via name (hack simples para Fase 2)
            # Na Fase 3, o executor lerá coordinate diretamente
            params = ActionParams(
                text=None,
                key=button,
                # deltaX/Y usados como coordenadas para computer use
                deltaX=float(x),
                deltaY=float(y),
            )

        return Action(
            actionId=action_id,
            snapshotId=snapshot_id,
            type="double_click" if action_type == "double_click" else "click",
            target=target,
            params=params,
            reasoning=f"[Computer Use] {action_type} em ({coordinate})",
            confidence=0.92,
        )

    if action_type == "type":
        return Action(
            actionId=action_id,
            snapshotId=snapshot_id,
            type="type",
            params=ActionParams(text=text),
            reasoning=f"[Computer Use] Digitar: {str(text)[:60]}",
            confidence=0.95,
        )

    if action_type == "key":
        return Action(
            actionId=action_id,
            snapshotId=snapshot_id,
            type="press_key",
            params=ActionParams(key=key),
            reasoning=f"[Computer Use] Tecla: {key}",
            confidence=0.95,
        )

    if action_type == "scroll":
        delta_y = 0
        delta_x = 0
        if direction == "down":
            delta_y = amount * 100
        elif direction == "up":
            delta_y = -(amount * 100)
        elif direction == "right":
            delta_x = amount * 100
        elif direction == "left":
            delta_x = -(amount * 100)

        return Action(
            actionId=action_id,
            snapshotId=snapshot_id,
            type="scroll",
            params=ActionParams(deltaX=float(delta_x), deltaY=float(delta_y)),
            reasoning=f"[Computer Use] Scroll {direction} {amount}x",
            confidence=0.9,
        )

    if action_type == "left_click_drag":
        start = cu_input.get("start_coordinate", [0, 0])
        end = coordinate or [0, 0]
        # Drag não tem tipo próprio ainda, mas podemos usar scroll como proxy
        return Action(
            actionId=action_id,
            snapshotId=snapshot_id,
            type="scroll",
            params=ActionParams(deltaX=float(end[0] - start[0]), deltaY=float(end[1] - start[1])),
            reasoning=f"[Computer Use] Drag de {start} para {end}",
            confidence=0.85,
        )

    logger.warning(f"[computer_use] Ação desconhecida: {action_type}")
    return None


# ── Cliente principal ──────────────────────────────────────────────────────────

@dataclass
class ComputerUseResult:
    actions: list[Action]
    needs_screenshot: bool  # True se Claude pediu outro screenshot
    done: bool
    thinking: str


class ComputerUseClient:
    """
    Wraps Anthropic's Computer Use beta.

    Recebe um screenshot (base64 PNG) + objetivo + histórico e devolve
    uma lista de Actions que o nosso content script sabe executar.
    """

    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY não configurado no .env")
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def plan(
        self,
        objective: str,
        screenshot_b64: str,
        snapshot_id: str,
        url: str,
        viewport_width: int = 1280,
        viewport_height: int = 800,
        history: Optional[list[dict]] = None,
        max_actions: int = 5,
    ) -> ComputerUseResult:
        """
        Chama o Claude Computer Use e converte as tool_use blocks em Actions.

        Args:
            objective: Objetivo em linguagem natural.
            screenshot_b64: PNG em base64 (sem prefixo data:image).
            snapshot_id: ID do snapshot atual para referenciar nas Actions.
            url: URL atual (adicionado ao contexto).
            viewport_width/height: Tamanho da janela do browser.
            history: Mensagens anteriores para manter contexto multi-step.
            max_actions: Máximo de ações por chamada.
        """
        system = (
            "You are a browser automation agent controlling a real Chrome browser. "
            "The user's browser is open and you see a screenshot of the current page. "
            f"Current URL: {url}\n\n"
            "Your job: accomplish the objective by using the computer tool. "
            "Prefer clicking, typing and navigating. "
            "When the task is complete, stop using tools and say 'Task complete: <summary>'."
        )

        messages: list[dict] = list(history or [])
        if not messages:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Objective: {objective}\n\nPlease accomplish this objective. Take a screenshot first if you need to see the current state.",
                    },
                ],
            })

        response = self._client.beta.messages.create(
            model=COMPUTER_USE_MODEL,
            max_tokens=4096,
            system=system,
            tools=[_make_computer_tool(viewport_width, viewport_height)],
            messages=messages,
            betas=[BETA_HEADER],
        )

        logger.info(f"[computer_use] stop_reason={response.stop_reason}, blocks={len(response.content)}")

        actions: list[Action] = []
        needs_screenshot = False
        done = response.stop_reason == "end_turn"
        thinking_parts: list[str] = []

        for block in response.content:
            if block.type == "thinking":
                thinking_parts.append(block.thinking)

            elif block.type == "text":
                text = block.text.strip()
                if text:
                    thinking_parts.append(text)
                if "task complete" in text.lower():
                    done = True

            elif block.type == "tool_use" and block.name == "computer":
                cu_input = block.input
                if cu_input.get("action") == "screenshot":
                    needs_screenshot = True
                else:
                    action = _convert_cu_action(cu_input, snapshot_id)
                    if action:
                        actions.append(action)
                        if len(actions) >= max_actions:
                            break

        if done and not actions:
            actions.append(Action(
                actionId=str(uuid.uuid4()),
                snapshotId=snapshot_id,
                type="done",
                reasoning=" ".join(thinking_parts)[:200] or "Tarefa concluída via Computer Use",
                confidence=1.0,
            ))

        return ComputerUseResult(
            actions=actions,
            needs_screenshot=needs_screenshot,
            done=done,
            thinking=" ".join(thinking_parts)[:500],
        )

    def build_action_plan(self, result: ComputerUseResult, task_id: str) -> ActionPlan:
        return ActionPlan(
            planId=str(uuid.uuid4()),
            taskId=task_id,
            actions=result.actions,
            autonomyLevel="semi",
            requiresConfirmation=False,
        )
