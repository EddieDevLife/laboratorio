# Documentação de API — Backend (porta 3001)

Base URL: `http://localhost:3001`

Todos os endpoints aceitam e retornam `application/json`.  
Requests com body requerem `Content-Type: application/json`.

---

## Health

### `GET /health`
Verifica se o backend está ativo.

**Response 200**
```json
{ "status": "ok", "ts": "2026-06-15T12:00:00.000Z" }
```

---

## Estado (`/state`)

### `POST /state/snapshots`
Salva um snapshot do DOM capturado pelo frontend.

**Body**
```json
{
  "sessionId": "string",
  "url": "string",
  "title": "string",
  "tree": {},
  "stats": {
    "total": 120,
    "interactive": 15,
    "focusable": 20,
    "withAria": 8
  }
}
```

**Response 201**
```json
{
  "snapshot": { "id": "uuid", "sessionId": "...", "capturedAt": "...", "url": "...", "title": "...", "stats": {} },
  "change": { "id": "uuid", "diff": { "summary": "Primeiro snapshot: 120 elementos..." } }
}
```

---

### `GET /state/snapshots`
Lista snapshots. Query: `?sessionId=xxx`

### `GET /state/snapshots/:id`
Retorna snapshot por ID. **404** se não encontrado.

### `DELETE /state/snapshots/:id`
Remove snapshot. Response: `{ "ok": true }`

### `DELETE /state/snapshots`
Remove todos. Query opcional: `?sessionId=xxx`. Response: `{ "deleted": N }`

### `GET /state/changes`
Histórico de mudanças. Query: `?sessionId=xxx`

### `POST /state/compare`
Compara dois snapshots e retorna diff.

**Body**
```json
{ "fromId": "uuid-ou-null", "toId": "uuid" }
```

**Response 200**
```json
{
  "added": [], "removed": [], "changed": [],
  "summary": "URL mudou de /home para /about · +3 elementos"
}
```

---

## Contexto (`/context`)

### `POST /context/sessions`
Cria sessão.

**Body** `{ "label": "string (opcional)" }`  
**Response 201** — objeto `Session` completo com `preferences` defaults.

### `GET /context/sessions`
Lista sessões ordenadas por `lastActivityAt` desc.

### `GET /context/sessions/:id`
Busca sessão. **404** se não encontrada.

### `DELETE /context/sessions/:id`
Remove sessão. Response: `{ "ok": true }`

### `GET /context/sessions/:id/preferences`
Retorna preferências da sessão.

**Response 200**
```json
{
  "language": "pt-BR",
  "theme": "dark",
  "ttsEnabled": true,
  "ttsRate": 1.1,
  "autoCapture": false,
  "screenshotFormat": "png"
}
```

### `PATCH /context/sessions/:id/preferences`
Atualiza preferências (merge parcial).

**Body** (campos opcionais)
```json
{ "ttsRate": 1.5, "theme": "light", "screenshotFormat": "jpeg" }
```

### `POST /context/sessions/:id/interactions`
Registra uma interação do usuário.

**Body**
```json
{
  "type": "command | click | navigate | capture | screenshot | llm",
  "input": "string (opcional)",
  "output": "string (opcional)",
  "metadata": {},
  "durationMs": 120
}
```

### `GET /context/sessions/:id/interactions`
Lista interações da sessão. Query: `?limit=50` (default 50, retorna mais recentes primeiro).

### `DELETE /context/sessions/:id/interactions`
Limpa histórico de interações. Response: `{ "deleted": N }`

---

## Controle de Mouse (`/mouse`)

Todos os endpoints usam `:sessionId` como identificador da fila.

### `POST /mouse/:sessionId/move`
```json
{ "x": 100, "y": 200, "durationMs": 500 }
```

### `POST /mouse/:sessionId/click`
```json
{ "x": 100, "y": 200, "type": "click | doubleClick | rightClick" }
```

### `POST /mouse/:sessionId/type`
```json
{ "text": "hello world", "delayMs": 30 }
```

### `POST /mouse/:sessionId/key`
```json
{ "key": "Tab", "modifiers": ["ctrl", "shift"] }
```
Teclas válidas: qualquer `KeyboardEvent.key` — `Tab`, `Enter`, `Escape`, `ArrowDown`, `F1`, etc.

### `POST /mouse/:sessionId/scroll`
```json
{ "x": 0, "y": 500, "deltaX": 0, "deltaY": 300 }
```

### `POST /mouse/:sessionId/batch`
Enfileira múltiplos comandos de uma vez.

**Body**
```json
{
  "commands": [
    { "type": "move", "x": 100, "y": 200 },
    { "type": "click", "x": 100, "y": 200 },
    { "type": "type", "text": "texto" },
    { "type": "key", "key": "Enter" }
  ]
}
```

**Response 201**
```json
{ "queued": 4, "items": [ /* QueuedCommand[] */ ] }
```

### `GET /mouse/:sessionId/queue`
**Poll endpoint** — retorna comandos `pending` e os marca como `sent`.  
O frontend chama periodicamente, executa cada comando e chama `/ack`.

### `GET /mouse/:sessionId/peek`
Visualiza pendentes sem alterar status.

### `POST /mouse/:sessionId/ack/:commandId`
Confirma execução de um comando.

**Body** `{ "error": "string (opcional — omita se sucesso)" }`

### `DELETE /mouse/:sessionId/queue`
Limpa toda a fila. Response: `{ "cleared": N }`

### `GET /mouse/:sessionId/stats`
```json
{ "total": 10, "pending": 2, "sent": 3, "done": 4, "error": 1 }
```

---

## LLM (`/llm`)

### `POST /llm/analyze`
Envia instrução + snapshot DOM para o Claude gerar comandos automaticamente.

**Body**
```json
{
  "sessionId": "string",
  "instruction": "Clique no botão Login e preencha o formulário",
  "domSnapshot": { /* DOMSnapshot serializado (opcional) */ },
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "apiKey": "sk-ant-... (opcional — usa ANTHROPIC_API_KEY do ambiente)"
}
```

**Response 200**
```json
{
  "reasoning": "Identifiquei o botão Login na posição...",
  "commands": [
    { "type": "move", "x": 450, "y": 230 },
    { "type": "click", "x": 450, "y": 230 }
  ],
  "narration": "Clicando em Login",
  "done": false
}
```

Os `commands` são **enfileirados automaticamente** na fila do `sessionId`.

### `POST /llm/analyze-screenshot`
Igual a `/llm/analyze` mas com screenshot base64 para análise visual.

**Body adicional**
```json
{
  "screenshotBase64": "<base64 sem prefixo data:>",
  "mimeType": "image/png"
}
```

---

## Visão Computacional (`/vision`)

### `POST /vision/analyze`
Analisa screenshot com Claude Vision.

**Body**
```json
{
  "sessionId": "string",
  "screenshotBase64": "<base64>",
  "mimeType": "image/png",
  "tasks": ["detect_elements", "ocr", "colors", "patterns"],
  "apiKey": "sk-ant-... (opcional)"
}
```

**Response 201** — objeto `VisionAnalysis`:
```json
{
  "id": "uuid",
  "sessionId": "string",
  "analyzedAt": "ISO8601",
  "imageWidth": 1280,
  "imageHeight": 720,
  "summary": "Interface de login com campos de email e senha",
  "elements": [
    {
      "id": "uuid",
      "kind": "button | input | link | image | text | select | checkbox | other",
      "label": "Entrar",
      "confidence": 0.97,
      "bounds": { "x": 400, "y": 300, "width": 120, "height": 40, "centerX": 460, "centerY": 320 },
      "attributes": { "type": "submit" }
    }
  ],
  "ocr": [
    { "text": "Bem-vindo", "bounds": { ... }, "confidence": 0.99, "language": "pt" }
  ],
  "dominantColors": [
    { "hex": "#1a1a2e", "rgb": [26, 26, 46], "name": "navy dark", "coverage": 0.45 }
  ],
  "patterns": ["login-form", "navigation-bar"]
}
```

### `GET /vision/analyses`
Lista análises. Query: `?sessionId=xxx`

### `GET /vision/analyses/:id`
Retorna análise por ID.

### `DELETE /vision/analyses/:id`
Remove análise.

### `GET /vision/analyses/:id/elements`
Todos os elementos detectados.

### `GET /vision/analyses/:id/elements/:kind`
Filtra por tipo: `button | input | link | image | text | select | checkbox | other`

### `GET /vision/analyses/:id/at?x=N&y=N`
Elemento que contém o pixel `(x, y)`. **404** se nenhum.

### `GET /vision/analyses/:id/ocr`
Todos os blocos de texto OCR.

### `GET /vision/analyses/:id/ocr/search?q=texto`
Busca case-insensitive nos blocos OCR.

### `GET /vision/analyses/:id/colors`
Paleta de cores dominantes.

### `GET /vision/analyses/:id/patterns`
Padrões de UI detectados.

---

## Códigos de erro

| Status | Significado |
|--------|-------------|
| 400 | Body inválido ou campo obrigatório ausente |
| 404 | Recurso não encontrado |
| 415 | `Content-Type` não é `application/json` |
| 502 | Erro na chamada à API Anthropic |
| 500 | Erro interno do servidor |

**Formato de erro**
```json
{ "error": "Descrição do problema" }
```
