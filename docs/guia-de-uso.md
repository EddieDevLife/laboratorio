# Guia de Uso — Mouse Automation System

## Visão Geral

O **Mouse Automation System** é uma plataforma para automatizar interações com interfaces web usando dois modos complementares:

| Modo | Como funciona | Quando usar |
|------|--------------|-------------|
| **DOM / Acessibilidade** | Lê a estrutura semântica da página (HTML + ARIA) | Páginas com markup correto; automação precisa; leitores de tela |
| **Visão Computacional** | Analisa pixels com Claude Vision | Páginas legadas sem semântica; verificação visual; OCR |

---

## Pré-requisitos

- Node.js ≥ 20
- pnpm ≥ 9
- Chave de API da Anthropic (para LLM e Visão Computacional)

---

## Instalação

```bash
# Frontend
pnpm install

# Backend
cd backend && pnpm install
```

---

## Executar em desenvolvimento

```bash
# Terminal 1 — frontend (http://localhost:5173)
pnpm dev

# Terminal 2 — backend (http://localhost:3001)
cd backend && pnpm dev
```

> **API Key:** export `ANTHROPIC_API_KEY=sk-ant-...` no ambiente do backend, ou envie a chave em cada request via campo `apiKey`.

---

## Interface do Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ MouseAgent                          ● Backend online  session: local │
├──────────────┬──────────────────────────────────┬───────────────┤
│              │                                  │               │
│  Modo        │   Área de conteúdo               │  Histórico    │
│  ─────────   │                                  │  de ações     │
│  🌳 DOM      │   (painel ativo conforme          │               │
│  👁 Visão    │    navegação lateral)             │               │
│              │                                  │               │
│  Navegação   │                                  │               │
│  ─────────   │                                  │               │
│  🌳 Cap. DOM │                                  │               │
│  ♿ A11y     │                                  │               │
│  📸 Screens  │                                  │               │
│  🔍 Detectar │                                  │               │
│  📝 OCR      │                                  │               │
└──────────────┴──────────────────────────────────┴───────────────┘
```

---

## Modo DOM / Acessibilidade

### 1. Captura de DOM

1. Acesse **🌳 Captura de DOM** na sidebar
2. Clique em **Capturar DOM**
3. Explore as abas:
   - **🌳 Árvore** — navegue pela hierarquia clicando nos nós
   - **⚡ Interativos** — lista filtrada por tipo de elemento
   - **♿ ARIA** — atributos `aria-*` agrupados por role
   - **{ } JSON** — serialização completa para download ou cópia

### 2. Accessibility Tree (Navegação por Teclado)

1. Acesse **♿ DOM / Acessibilidade**
2. Clique em **🔍 Analisar estrutura** para mapear todos os elementos focáveis
3. Use o **Simulador de Teclado** para navegar:
   - `⇥ Tab` / `⇤ Shift+Tab` — próximo/anterior elemento focável
   - `↵ Enter` — ativa botão ou link com foco
   - `✕ Esc` — fecha modal / cancela
   - `␣ Space` — marca checkbox, ativa botão
   - Setas `▲▼◀▶` — navega em menus, listas, sliders
4. Tabs de resultado:
   - **⌨ Ordem de Tab** — lista com `#ordem`, tag, role, estados e detalhe ao clicar
   - **📋 Eventos** — histórico de cada tecla simulada com efeito em português
   - **🏗 Estrutura** — rótulos, grid de estados, alertas de acessibilidade (⚠ sem rótulo)

### 3. Screenshots

1. Acesse **📸 Screenshots**
2. Escolha o formato de saída (PNG / JPEG / WebP)
3. Capture:
   - **📷 Viewport** — área visível atual
   - **📄 Página inteira** — scroll completo
4. Clique em uma miniatura para ver detalhes e baixar

---

## Modo Visão Computacional

### 1. Detectar elementos

1. Acesse **🔍 Detecção de Elementos**
2. Selecione as tarefas desejadas: `🔍 Elementos` `📝 OCR` `🎨 Cores` `🧩 Padrões`
3. Clique em **📷 Capturar e Analisar** ou faça **📂 Upload** de uma imagem
4. O Claude Vision retorna bounding boxes coloridas por tipo:

   | Cor | Tipo |
   |-----|------|
   | 🔵 Azul | Botão |
   | 🟢 Verde | Campo de texto |
   | 🟣 Roxo | Link |
   | 🟠 Laranja | Imagem |
   | ⬛ Cinza | Texto |

5. Clique em qualquer bounding box para ver detalhes (posição, tamanho, confiança)

### 2. OCR & Cores

1. Acesse **📝 OCR & Cores**
2. Após análise, navegue pelas abas:
   - **📝 OCR** — busque texto extraído em tempo real (`≥ 2 chars`)
   - **🎨 Cores** — paleta dominante com swatch, hex, RGB e percentual de cobertura
   - **🧩 Padrões** — padrões de UI detectados (`login-form`, `data-table`, etc.)

---

## Integração com LLM (via Backend)

Para gerar comandos de mouse automaticamente a partir de linguagem natural:

```bash
curl -X POST http://localhost:3001/llm/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "minha-sessao",
    "instruction": "Clique no botão Pesquisar e digite nodejs",
    "apiKey": "sk-ant-..."
  }'
```

A resposta inclui:
- `commands[]` — enfileirados automaticamente para execução
- `narration` — texto para TTS
- `reasoning` — raciocínio do modelo
- `done` — se o objetivo foi concluído

O frontend pode fazer **poll** em `GET /mouse/:sessionId/queue` para receber e executar os comandos.

---

## Executar testes

```bash
# Frontend (126 testes)
pnpm test:run

# Backend (45+ testes)
cd backend && pnpm test:run

# Com cobertura
pnpm test:coverage
cd backend && pnpm test:coverage
```
