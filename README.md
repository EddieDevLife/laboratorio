# Mouse Automation System

Um sistema avançado de automação de desktop que move o cursor do mouse através de duas abordagens:

## Abordagens

### 1. **Visão Computacional (Computer Vision)**
- Captura screenshots da tela
- Detecta elementos visuais e posições
- Move o mouse para coordenadas específicas
- Ideal para interfaces complexas e dinâmicas

### 2. **Navegação por DOM + Accessibility Tree**
- Lê a estrutura DOM da página web
- Navega através da árvore de acessibilidade
- Simula navegação por teclado (Tab, Enter, etc)
- Ideal para aplicações web

## Arquitetura

```
┌─────────────────────────────────────────┐
│       Frontend Web (React)              │
│  - DOM Capture                          │
│  - Accessibility Tree Reader            │
│  - Screenshot Capture                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│    Backend (Node.js + Express)          │
│  - State Management                     │
│  - User Context Storage                 │
│  - LLM Integration                      │
│  - Mouse Control Commands               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│    Mouse Control Layer                  │
│  - Move Cursor                          │
│  - Click                                │
│  - Keyboard Input                       │
└─────────────────────────────────────────┘
```

## Funcionalidades Principais

- ✅ Captura de DOM e Accessibility Tree
- ✅ Captura de Screenshots
- ✅ Controle de Mouse (movimento, cliques)
- ✅ Navegação por teclado
- ✅ Armazenamento de estado
- ✅ Contexto do usuário
- ✅ Integração com LLM
- ✅ Dois modos de operação

## Como Usar

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Build para produção
pnpm build
```

## Tecnologias

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Automação**: Puppeteer (screenshots), Robotjs (mouse control)
- **IA**: Google Gemini / OpenAI GPT-4V
