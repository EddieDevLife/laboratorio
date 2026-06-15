# Mouse Automation System

Plataforma para automatizar interações com interfaces web via dois modos complementares: **DOM/Acessibilidade** (semântica) e **Visão Computacional** (pixels + Claude Vision).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Testes | Vitest + Testing Library + Supertest |
| LLM | Claude (Anthropic API) |
| Screenshots | html2canvas |

---

## Início rápido

```bash
# Instalar dependências
pnpm install
cd backend && pnpm install && cd ..

# Configurar API key (necessário para LLM e Visão)
export ANTHROPIC_API_KEY=sk-ant-...

# Subir frontend + backend
pnpm dev                   # http://localhost:5173
cd backend && pnpm dev     # http://localhost:3001
```

---

## Funcionalidades

### Frontend (React)
- 🌳 **Captura de DOM** — árvore hierárquica, atributos ARIA, serialização JSON
- ♿ **Accessibility Tree** — ordem de Tab, simulação de teclado, estados, auditoria de rótulos
- 📸 **Screenshots** — viewport ou página inteira, galeria com download/cópia
- 👁 **Visão Computacional** — detecção de elementos, OCR, paleta de cores, padrões de UI
- 📋 **Histórico de ações** — feed cronológico de todas as interações da sessão

### Backend (Express)
- 💾 **Estado** — snapshots de DOM, histórico de mudanças, diff entre capturas
- 👤 **Contexto** — sessões, preferências, histórico de interações
- 🖱 **Controle de Mouse** — fila de comandos com poll/ack (move, click, type, key, scroll)
- 🤖 **LLM** — instrução em linguagem natural → sequência de comandos automática
- 🔬 **Vision API** — análise de screenshot com bounding boxes, OCR, cores, padrões

---

## Testes

```bash
# Frontend — 126 testes
pnpm test:run

# Backend — 45 testes
cd backend && pnpm test:run

# Com cobertura
pnpm test:coverage
```

---

## Estrutura do projeto

```
/
├── src/
│   ├── components/       # DOMCapturePanel, VisionPanel, ScreenshotsPanel, DOMAccessibilityPanel
│   ├── hooks/            # useDOMCapture, useScreenshot, useVision, useKeyboardNav, useActionHistory
│   ├── styles/           # CSS por componente (dark theme)
│   └── __tests__/        # Testes unitários de hooks
├── backend/
│   └── src/
│       ├── state/        # Snapshots e diffs de DOM
│       ├── context/      # Sessões, preferências, interações
│       ├── mouse/        # Fila de comandos
│       ├── llm/          # Cliente Anthropic
│       ├── vision/       # Análise com Claude Vision
│       └── routes/       # Express routers
└── docs/
    ├── guia-de-uso.md
    ├── api.md
    ├── exemplos.md
    └── troubleshooting.md
```

---

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [Guia de uso](docs/guia-de-uso.md) | Passo a passo de cada funcionalidade |
| [API Reference](docs/api.md) | Todos os endpoints com body/response |
| [Exemplos](docs/exemplos.md) | curl, TypeScript, poll loop |
| [Troubleshooting](docs/troubleshooting.md) | Erros comuns e soluções |

---

## Segurança

- API keys nunca são hardcoded — use variável de ambiente `ANTHROPIC_API_KEY` ou envie via `apiKey` no body
- `.env`, `secrets.json` e `api-keys.json` estão no `.gitignore`
- Permissões de host na extensão são `optional_host_permissions`
