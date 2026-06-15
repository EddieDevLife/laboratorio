# Exemplos de Uso

## 1. Automatizar login em um formulário

**Objetivo:** entrar em `https://app.exemplo.com` com email e senha.

### Via LLM (linguagem natural)

```bash
# 1. Criar sessão
curl -X POST http://localhost:3001/context/sessions \
  -H "Content-Type: application/json" \
  -d '{ "label": "login-exemplo" }'
# → { "id": "sess-abc123", ... }

# 2. Enviar instrução ao LLM com snapshot DOM
curl -X POST http://localhost:3001/llm/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-abc123",
    "instruction": "Preencha o campo email com user@example.com, a senha com minhasenha123 e clique em Entrar",
    "apiKey": "sk-ant-..."
  }'
# O LLM enfileira automaticamente: type(email) → type(senha) → click(Entrar)

# 3. Frontend faz poll e executa
curl http://localhost:3001/mouse/sess-abc123/queue
# → [{ "id": "cmd-1", "command": { "type": "type", "text": "user@example.com" }, ... }]

# 4. Confirmar execução de cada comando
curl -X POST http://localhost:3001/mouse/sess-abc123/ack/cmd-1 \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Via comandos diretos (sem LLM)

```bash
SESSION="sess-abc123"

# Enfileirar sequência completa
curl -X POST http://localhost:3001/mouse/$SESSION/batch \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      { "type": "click", "x": 640, "y": 280 },
      { "type": "type", "text": "user@example.com" },
      { "type": "key", "key": "Tab" },
      { "type": "type", "text": "minhasenha123" },
      { "type": "key", "key": "Enter" }
    ]
  }'
```

---

## 2. Capturar DOM e analisar acessibilidade

```bash
# 1. Capturar DOM via frontend (UI) e enviar ao backend
curl -X POST http://localhost:3001/state/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "auditoria",
    "url": "https://site.com",
    "title": "Página inicial",
    "tree": { "tag": "body", "children": [] },
    "stats": { "total": 85, "interactive": 12, "focusable": 15, "withAria": 6 }
  }'

# 2. Ver histórico de mudanças entre capturas
curl http://localhost:3001/state/changes?sessionId=auditoria

# 3. Comparar dois snapshots
curl -X POST http://localhost:3001/state/compare \
  -H "Content-Type: application/json" \
  -d '{ "fromId": "snap-1", "toId": "snap-2" }'
# → { "summary": "URL mudou · +3 elementos interativos" }
```

---

## 3. Análise visual com Claude Vision

```bash
# Screenshot em base64 (sem o prefixo "data:image/png;base64,")
SCREENSHOT=$(base64 -i screenshot.png)

curl -X POST http://localhost:3001/vision/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"visual-test\",
    \"screenshotBase64\": \"$SCREENSHOT\",
    \"tasks\": [\"detect_elements\", \"ocr\", \"colors\"],
    \"apiKey\": \"sk-ant-...\"
  }"

# Buscar todos os botões detectados
ANALYSIS_ID="<id retornado acima>"
curl http://localhost:3001/vision/analyses/$ANALYSIS_ID/elements/button

# Buscar texto na tela
curl "http://localhost:3001/vision/analyses/$ANALYSIS_ID/ocr/search?q=entrar"

# Elemento na posição (450, 300)
curl "http://localhost:3001/vision/analyses/$ANALYSIS_ID/at?x=450&y=300"
```

---

## 4. Navegar por teclado e auditar acessibilidade (UI)

No Dashboard:

1. Abrir **♿ DOM / Acessibilidade**
2. Clicar **🔍 Analisar estrutura**
3. Navegar com o simulador de teclado:
   - `⇥ Tab` 5 vezes para percorrer os primeiros 5 elementos
   - `↵ Enter` para ativar o elemento focado
4. Ir na aba **🏗 Estrutura** → seção **⚠ Problemas de Acessibilidade**
   - Lista todos os botões, links e campos sem rótulo (`aria-label` ou `<label>`)

---

## 5. Screenshot + Análise de cores para design review

No Dashboard:

1. Ir em **📸 Screenshots** → **📷 Viewport**
2. Ir em **👁 Visão Computacional** → ativar `🎨 Cores` → **📷 Capturar e Analisar**
3. Aba **🎨 Cores**:
   - Swatches com nome, hex, RGB
   - Barra de percentual de cobertura
4. Aba **🧩 Padrões**: `login-form`, `navigation-bar`, `data-table`, etc.

---

## 6. Integração com código TypeScript (frontend → backend)

```typescript
// Capturar DOM e enviar ao backend
import { useDOMCapture } from './hooks/useDOMCapture';
import { useScreenshot } from './hooks/useScreenshot';

const { capture, snapshot } = useDOMCapture();
const { captureViewport } = useScreenshot();

// Captura sincrona do DOM
capture();

// Envia snapshot ao backend
await fetch('http://localhost:3001/state/snapshots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'minha-sessao',
    url: snapshot!.url,
    title: snapshot!.title,
    tree: snapshot!.tree,
    stats: {
      total: snapshot!.totalNodes,
      interactive: snapshot!.interactiveCount,
      focusable: snapshot!.focusableCount,
      withAria: 0,
    },
  }),
});

// Análise LLM com DOM
const shot = await captureViewport();
const res = await fetch('http://localhost:3001/llm/analyze-screenshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'minha-sessao',
    instruction: 'Quais elementos estão visíveis?',
    screenshotBase64: shot!.dataUrl.split(',')[1],
    mimeType: 'image/png',
  }),
});
const { commands, narration, done } = await res.json();
console.log(narration); // "Identificado formulário de login com 3 campos"
```

---

## 7. Poll loop no frontend para executar comandos

```typescript
const SESSION = 'minha-sessao';

async function executionLoop() {
  while (true) {
    const res = await fetch(`http://localhost:3001/mouse/${SESSION}/queue`);
    const commands = await res.json();

    for (const { id, command } of commands) {
      try {
        await executeCommand(command); // sua lógica de automação
        await fetch(`http://localhost:3001/mouse/${SESSION}/ack/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch (err) {
        await fetch(`http://localhost:3001/mouse/${SESSION}/ack/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: String(err) }),
        });
      }
    }

    await new Promise(r => setTimeout(r, 200)); // poll a cada 200ms
  }
}
```
