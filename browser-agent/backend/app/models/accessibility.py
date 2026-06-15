from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class AccessibilityNode(BaseModel):
    nodeId: str
    role: str
    name: str
    description: Optional[str] = None
    value: Optional[str] = None
    checked: Optional[bool] = None
    disabled: bool
    focused: bool
    visible: bool
    bounds: dict  # {x, y, width, height}
    attributes: dict[str, str] = {}
    children: list[AccessibilityNode] = []


class PageSnapshot(BaseModel):
    snapshotId: str
    tabId: int
    url: str
    title: str
    timestamp: int
    tree: AccessibilityNode
    source: str  # 'cdp' | 'dom'
    scrollX: float = 0
    scrollY: float = 0
    viewportWidth: float = 0
    viewportHeight: float = 0
