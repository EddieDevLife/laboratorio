"""
Converte PageSnapshot → contexto compacto para o LLM.

Usa o formato indexado do browser-use:
    [1]<button>Submit</button>
    [2]<input type=text placeholder="Search" />
    [3]<a href="...">About us</a>

Só elementos interativos recebem [index]. Nós invisíveis e desabilitados
são omitidos. Profundidade máxima e total de tokens são limitados para
não estourar a janela de contexto.
"""
from __future__ import annotations

from ..models.accessibility import AccessibilityNode, PageSnapshot

# Roles que são interativos e merecem um [index]
INTERACTIVE_ROLES = {
    "button", "link", "textbox", "searchbox", "combobox",
    "checkbox", "radio", "menuitem", "menuitemcheckbox", "menuitemradio",
    "option", "tab", "slider", "spinbutton", "switch",
    "treeitem", "gridcell",
}

# Roles de conteúdo que aparecem sem [index] (somente como contexto textual)
CONTENT_ROLES = {"heading", "paragraph", "text", "label", "img", "figure"}

MAX_NODES = 200
MAX_DEPTH = 12


def _attrs(node: AccessibilityNode) -> str:
    parts: list[str] = []
    if node.value:
        parts.append(f'value="{node.value[:80]}"')
    if node.checked is True:
        parts.append("checked")
    if node.disabled:
        parts.append("disabled")
    for k, v in node.attributes.items():
        if k.startswith("aria-") and k not in ("aria-label", "aria-labelledby"):
            parts.append(f'{k}="{v}"')
    return " ".join(parts)


def _build_lines(
    node: AccessibilityNode,
    counter: list[int],
    lines: list[str],
    id_to_node: dict[int, AccessibilityNode],
    depth: int = 0,
) -> None:
    if depth > MAX_DEPTH or len(lines) >= MAX_NODES:
        return
    if not node.visible:
        return

    indent = "\t" * depth
    role = node.role
    name = node.name[:120] if node.name else ""
    attrs = _attrs(node)
    attrs_str = f" {attrs}" if attrs else ""

    if role in INTERACTIVE_ROLES and not node.disabled:
        idx = counter[0]
        counter[0] += 1
        id_to_node[idx] = node
        tag = f"[{idx}]<{role}{attrs_str} />"
        if name:
            lines.append(f"{indent}{tag}")
            lines.append(f"{indent}\t{name}")
        else:
            lines.append(f"{indent}{tag}")
    elif role in CONTENT_ROLES and name:
        # Aparece como texto puro sem index
        lines.append(f"{indent}{name}")

    for child in node.children:
        _build_lines(child, counter, lines, id_to_node, depth + 1)


def build_context(snapshot: PageSnapshot) -> tuple[str, dict[int, AccessibilityNode]]:
    """
    Devolve (texto_formatado, mapa_index→node).

    O texto segue o formato browser-use para alimentar o Gemini.
    O mapa permite que o orchestrator resolva [index] → nodeId para o executor.
    """
    lines: list[str] = []
    counter = [1]
    id_to_node: dict[int, AccessibilityNode] = {}

    _build_lines(snapshot.tree, counter, lines, id_to_node)

    header = (
        f"URL: {snapshot.url}\n"
        f"Title: {snapshot.title}\n"
        f"Viewport: {int(snapshot.viewportWidth)}x{int(snapshot.viewportHeight)}, "
        f"scroll: ({int(snapshot.scrollX)}, {int(snapshot.scrollY)})\n\n"
        "Interactive Elements:\n"
    )

    body = "\n".join(lines) or "(no interactive elements found)"
    return header + body, id_to_node
