# Exemplo: Controle de Mouse via Accessibility Tree

Este documento explica como usar a camada de acessibilidade para movimentar o cursor do mouse e automatizar interações com elementos da página.

## Arquitetura

```
┌─────────────────────────────────────────┐
│   Accessibility Tree Reader             │
│   (useAccessibilityTree hook)           │
│   - Captura DOM                         │
│   - Extrai informações ARIA             │
│   - Identifica elementos focáveis       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Mouse Control Layer                   │
│   (useMouseControl hook)                │
│   - Move cursor com animação            │
│   - Simula cliques                      │
│   - Executa comandos sequenciais        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Visual Cursor & DOM Events            │
│   - Renderiza cursor na tela            │
│   - Dispara eventos de mouse            │
│   - Ativa elementos interativos         │
└─────────────────────────────────────────┘
```

## Componentes Principais

### 1. Hook: `useAccessibilityTree`

Responsável por capturar e gerenciar a árvore de acessibilidade da página.

**Funcionalidades:**
- Captura a estrutura DOM completa
- Extrai informações ARIA (roles, labels, descrições)
- Identifica elementos focáveis
- Permite buscar elementos por label ou role
- Simula navegação por teclado (Tab)

**Exemplo de Uso:**

```typescript
import { useAccessibilityTree } from './hooks/useAccessibilityTree';

function MyComponent() {
  const {
    tree,
    focusableElements,
    captureTree,
    findElementByLabel,
    getElementCenter,
  } = useAccessibilityTree();

  // Capturar árvore de acessibilidade
  const handleCapture = () => {
    const { tree, focusable } = captureTree();
    console.log('Elementos focáveis:', focusable);
  };

  // Encontrar elemento pela label
  const handleFindButton = () => {
    const button = findElementByLabel('Enviar');
    if (button) {
      const center = getElementCenter(button);
      console.log(`Botão está em: ${center.x}, ${center.y}`);
    }
  };

  return (
    <>
      <button onClick={handleCapture}>Capturar Árvore</button>
      <button onClick={handleFindButton}>Encontrar Botão</button>
    </>
  );
}
```

### 2. Hook: `useMouseControl`

Responsável por controlar o movimento do mouse e simular interações.

**Funcionalidades:**
- Move cursor com animação suave
- Simula cliques (esquerdo, direito, duplo)
- Simula arrasto (drag)
- Executa fila de comandos
- Cria cursor visual para debug

**Exemplo de Uso:**

```typescript
import { useMouseControl } from './hooks/useMouseControl';

function MyComponent() {
  const {
    moveCursor,
    click,
    executeCommands,
    createVisualCursor,
  } = useMouseControl();

  // Mover cursor para uma posição
  const handleMove = async () => {
    createVisualCursor();
    await moveCursor(500, 300, 800); // x, y, duration
  };

  // Clicar em uma posição
  const handleClick = async () => {
    await click(500, 300, 'left');
  };

  // Executar sequência de comandos
  const handleSequence = async () => {
    await executeCommands([
      { type: 'move', x: 100, y: 100, duration: 500 },
      { type: 'click', x: 100, y: 100 },
      { type: 'move', x: 200, y: 200, duration: 500 },
      { type: 'click', x: 200, y: 200 },
    ]);
  };

  return (
    <>
      <button onClick={handleMove}>Mover Cursor</button>
      <button onClick={handleClick}>Clicar</button>
      <button onClick={handleSequence}>Executar Sequência</button>
    </>
  );
}
```

## Exemplo Completo: Automação de Formulário

```typescript
import React from 'react';
import { useAccessibilityTree } from './hooks/useAccessibilityTree';
import { useMouseControl } from './hooks/useMouseControl';

export function FormAutomation() {
  const {
    captureTree,
    findElementByLabel,
    getElementCenter,
    activateElement,
  } = useAccessibilityTree();

  const {
    click,
    executeCommands,
    createVisualCursor,
  } = useMouseControl();

  /**
   * Automatiza o preenchimento de um formulário
   */
  const automateForm = async () => {
    createVisualCursor();

    // Capturar árvore
    captureTree();

    // Encontrar elementos
    const nameInput = findElementByLabel('Nome');
    const emailInput = findElementByLabel('Email');
    const submitButton = findElementByLabel('Enviar');

    if (!nameInput || !emailInput || !submitButton) {
      console.error('Elementos não encontrados');
      return;
    }

    // Executar sequência
    const commands = [
      // Mover para campo de nome
      {
        type: 'move' as const,
        x: nameInput.x + nameInput.width / 2,
        y: nameInput.y + nameInput.height / 2,
        duration: 500,
      },
      // Clicar no campo de nome
      {
        type: 'click' as const,
        x: nameInput.x + nameInput.width / 2,
        y: nameInput.y + nameInput.height / 2,
      },
      // Mover para campo de email
      {
        type: 'move' as const,
        x: emailInput.x + emailInput.width / 2,
        y: emailInput.y + emailInput.height / 2,
        duration: 500,
      },
      // Clicar no campo de email
      {
        type: 'click' as const,
        x: emailInput.x + emailInput.width / 2,
        y: emailInput.y + emailInput.height / 2,
      },
      // Mover para botão de envio
      {
        type: 'move' as const,
        x: submitButton.x + submitButton.width / 2,
        y: submitButton.y + submitButton.height / 2,
        duration: 500,
      },
      // Clicar no botão
      {
        type: 'click' as const,
        x: submitButton.x + submitButton.width / 2,
        y: submitButton.y + submitButton.height / 2,
      },
    ];

    await executeCommands(commands);
  };

  return (
    <button onClick={automateForm}>
      🤖 Automatizar Formulário
    </button>
  );
}
```

## Tipos de Dados

### AccessibilityNode

```typescript
interface AccessibilityNode {
  id: string;                    // ID único do nó
  role: string;                  // Role ARIA (button, link, textbox, etc)
  label: string;                 // Label/nome acessível
  description?: string;          // Descrição ARIA
  x: number;                     // Posição X na tela
  y: number;                     // Posição Y na tela
  width: number;                 // Largura do elemento
  height: number;                // Altura do elemento
  focusable: boolean;            // Se pode receber foco
  visible: boolean;              // Se é visível
  children: AccessibilityNode[]; // Filhos do nó
  element?: HTMLElement;         // Referência ao elemento DOM
}
```

### MouseCommand

```typescript
interface MouseCommand {
  type: 'move' | 'click' | 'doubleClick' | 'rightClick' | 'drag';
  x: number;                     // Posição X
  y: number;                     // Posição Y
  duration?: number;             // Duração da animação (ms)
  button?: 'left' | 'right' | 'middle';
  toX?: number;                  // Para drag: posição X final
  toY?: number;                  // Para drag: posição Y final
}
```

## Funcionalidades Avançadas

### 1. Navegação por Teclado

```typescript
const { navigateByTab } = useAccessibilityTree();

// Navegar para próximo elemento focável
const nextElement = navigateByTab(true);

// Navegar para elemento anterior
const prevElement = navigateByTab(false);
```

### 2. Busca por Role

```typescript
const { findElementByRole } = useAccessibilityTree();

// Encontrar primeiro botão
const button = findElementByRole('button', 0);

// Encontrar segundo campo de texto
const input = findElementByRole('textbox', 1);
```

### 3. Ativação de Elementos

```typescript
const { activateElement } = useAccessibilityTree();

// Ativa um elemento (foca e clica se for botão/link)
activateElement(element);
```

### 4. Arrasto (Drag)

```typescript
const { drag } = useMouseControl();

// Arrastar de (100, 100) para (200, 200) em 500ms
await drag(100, 100, 200, 200, 500);
```

## Casos de Uso

1. **Testes Automatizados** - Automatizar testes de UI
2. **Automação de Tarefas** - Preencher formulários automaticamente
3. **Acessibilidade** - Navegar por teclado programaticamente
4. **Demonstrações** - Mostrar interações com a página
5. **Bots** - Criar bots que interagem com interfaces web

## Limitações

- Funciona apenas em páginas web (não em aplicações desktop nativas)
- Requer acesso ao DOM (não funciona em iframes com cross-origin)
- Eventos de mouse são simulados (alguns sites podem detectar)
- Não funciona com elementos ocultos ou muito pequenos

## Performance

- Captura inicial: ~50-200ms (depende do tamanho da página)
- Movimento do cursor: Suave com 60fps
- Cliques: Instantâneos
- Fila de comandos: ~100ms entre cada comando

## Conclusão

Este sistema permite automatizar interações com páginas web de forma robusta e acessível, usando a camada de acessibilidade como base. É ideal para testes automatizados, automação de tarefas e criação de bots inteligentes.
