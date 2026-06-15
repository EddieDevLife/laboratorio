from __future__ import annotations
from typing import Literal, Optional, Any
from pydantic import BaseModel


ActionType = Literal[
    "click", "type", "clear", "focus", "press_key",
    "scroll", "navigate", "wait", "extract", "screenshot", "done", "error"
]

AutonomyLevel = Literal["reactive", "semi", "full"]


class ActionTarget(BaseModel):
    nodeId: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    index: Optional[int] = None


class ActionParams(BaseModel):
    text: Optional[str] = None
    key: Optional[str] = None
    url: Optional[str] = None
    deltaX: Optional[float] = None
    deltaY: Optional[float] = None
    ms: Optional[int] = None
    selector: Optional[str] = None


class Action(BaseModel):
    actionId: str
    snapshotId: str
    type: ActionType
    target: Optional[ActionTarget] = None
    params: Optional[ActionParams] = None
    reasoning: Optional[str] = None
    confidence: float = 1.0


class ActionPlan(BaseModel):
    planId: str
    taskId: str
    actions: list[Action]
    autonomyLevel: AutonomyLevel = "reactive"
    requiresConfirmation: bool = True


class ActionResult(BaseModel):
    actionId: str
    success: bool
    error: Optional[str] = None
    extractedData: Optional[Any] = None
    newSnapshotAvailable: bool = False
