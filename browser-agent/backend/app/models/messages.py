from __future__ import annotations
from typing import Literal, Union, Any
from pydantic import BaseModel

from .accessibility import PageSnapshot
from .actions import ActionPlan, ActionResult


# ── Extension → Backend ───────────────────────────────────────────────────────

class SnapshotMessage(BaseModel):
    type: Literal["snapshot"] = "snapshot"
    payload: PageSnapshot


class EventMessage(BaseModel):
    type: Literal["event"] = "event"
    payload: dict[str, Any]


class ActionResultMessage(BaseModel):
    type: Literal["action_result"] = "action_result"
    payload: ActionResult


class TaskStartMessage(BaseModel):
    type: Literal["task_start"] = "task_start"
    payload: dict[str, str]  # taskId, objective, autonomyLevel


class TaskCancelMessage(BaseModel):
    type: Literal["task_cancel"] = "task_cancel"
    payload: dict[str, str]  # taskId


class ScreenshotMessage(BaseModel):
    type: Literal["screenshot"] = "screenshot"
    payload: dict[str, str]  # snapshotId, imageBase64


class PingMessage(BaseModel):
    type: Literal["ping"] = "ping"


ExtensionMessage = Union[
    SnapshotMessage,
    EventMessage,
    ActionResultMessage,
    TaskStartMessage,
    TaskCancelMessage,
    ScreenshotMessage,
    PingMessage,
]


# ── Backend → Extension ───────────────────────────────────────────────────────

class ActionPlanMessage(BaseModel):
    type: Literal["action_plan"] = "action_plan"
    payload: ActionPlan


class RequestSnapshotMessage(BaseModel):
    type: Literal["request_snapshot"] = "request_snapshot"


class RequestScreenshotMessage(BaseModel):
    type: Literal["request_screenshot"] = "request_screenshot"
    payload: dict[str, str]  # reason


class TaskCompleteMessage(BaseModel):
    type: Literal["task_complete"] = "task_complete"
    payload: dict[str, str]  # taskId, summary


class TaskErrorMessage(BaseModel):
    type: Literal["task_error"] = "task_error"
    payload: dict[str, str]  # taskId, error


class PongMessage(BaseModel):
    type: Literal["pong"] = "pong"


BackendMessage = Union[
    ActionPlanMessage,
    RequestSnapshotMessage,
    RequestScreenshotMessage,
    TaskCompleteMessage,
    TaskErrorMessage,
    PongMessage,
]
