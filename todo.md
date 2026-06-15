# Mouse Automation System - TODO

## Frontend Web (React)

### Captura de DOM e Accessibility Tree
- [x] Componente para capturar estrutura DOM (`DOMCapturePanel.tsx`)
- [x] Leitor de Accessibility Tree (árvore hierárquica interativa com expand/collapse)
- [x] Serialização de DOM em JSON (`useDOMCapture.serializeToJSON` + download + copy)
- [x] Identificação de elementos interativos (tag, role, tabindex, handler, editable, draggable)
- [x] Extração de atributos ARIA (todos os `aria-*` com tipagem e conversão de tipos)

### Captura de Screenshots
- [x] Integração com html2canvas
- [x] Captura de viewport
- [x] Captura de página inteira
- [x] Armazenamento de screenshots

### Interface do Usuário
- [x] Dashboard principal
- [x] Seletor de modo (DOM vs Visão)
- [x] Visualizador de DOM
- [x] Visualizador de Accessibility Tree
- [x] Histórico de ações

## Backend (Node.js + Express)

### Gerenciamento de Estado
- [x] Armazenamento de estado da interface
- [x] Histórico de mudanças
- [x] Snapshot de estado
- [x] Comparação de estados

### Contexto do Usuário
- [x] Armazenamento de contexto
- [x] Histórico de interações
- [x] Preferências do usuário
- [x] Sessões de trabalho

### Controle de Mouse
- [x] API para mover cursor
- [x] API para cliques
- [x] API para entrada de teclado
- [x] Fila de comandos

### Integração com LLM
- [x] Análise de DOM com LLM
- [x] Análise de screenshots com LLM
- [x] Geração de comandos automáticos
- [x] Interpretação de instruções naturais

## Modo Visão Computacional

### Detecção de Elementos
- [x] Detecção de botões
- [x] Detecção de campos de texto
- [x] Detecção de links
- [x] Detecção de imagens
- [x] Localização de elementos

### Processamento de Screenshots
- [x] OCR para texto
- [x] Análise de cores
- [x] Detecção de padrões
- [x] Identificação de posições

## Modo DOM/Accessibility

### Navegação por Teclado
- [x] Simulação de Tab
- [x] Simulação de Enter
- [x] Simulação de Escape
- [x] Simulação de setas

### Análise de Estrutura
- [x] Identificação de elementos focáveis
- [x] Ordem de tabulação
- [x] Rótulos e descrições
- [x] Estados dos elementos

## Testes

- [x] Testes unitários frontend
- [x] Testes unitários backend
- [x] Testes de integração
- [x] Testes de automação

## Documentação

- [x] Guia de uso
- [x] Documentação de API
- [x] Exemplos de uso
- [x] Troubleshooting
