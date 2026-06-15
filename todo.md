# Mouse Automation System - TODO

## Frontend Web (React)

### Captura de DOM e Accessibility Tree
- [x] Componente para capturar estrutura DOM (`DOMCapturePanel.tsx`)
- [x] Leitor de Accessibility Tree (árvore hierárquica interativa com expand/collapse)
- [x] Serialização de DOM em JSON (`useDOMCapture.serializeToJSON` + download + copy)
- [x] Identificação de elementos interativos (tag, role, tabindex, handler, editable, draggable)
- [x] Extração de atributos ARIA (todos os `aria-*` com tipagem e conversão de tipos)

### Captura de Screenshots
- [ ] Integração com html2canvas
- [ ] Captura de viewport
- [ ] Captura de página inteira
- [ ] Armazenamento de screenshots

### Interface do Usuário
- [ ] Dashboard principal
- [ ] Seletor de modo (DOM vs Visão)
- [ ] Visualizador de DOM
- [ ] Visualizador de Accessibility Tree
- [ ] Histórico de ações

## Backend (Node.js + Express)

### Gerenciamento de Estado
- [ ] Armazenamento de estado da interface
- [ ] Histórico de mudanças
- [ ] Snapshot de estado
- [ ] Comparação de estados

### Contexto do Usuário
- [ ] Armazenamento de contexto
- [ ] Histórico de interações
- [ ] Preferências do usuário
- [ ] Sessões de trabalho

### Controle de Mouse
- [ ] API para mover cursor
- [ ] API para cliques
- [ ] API para entrada de teclado
- [ ] Fila de comandos

### Integração com LLM
- [ ] Análise de DOM com LLM
- [ ] Análise de screenshots com LLM
- [ ] Geração de comandos automáticos
- [ ] Interpretação de instruções naturais

## Modo Visão Computacional

### Detecção de Elementos
- [ ] Detecção de botões
- [ ] Detecção de campos de texto
- [ ] Detecção de links
- [ ] Detecção de imagens
- [ ] Localização de elementos

### Processamento de Screenshots
- [ ] OCR para texto
- [ ] Análise de cores
- [ ] Detecção de padrões
- [ ] Identificação de posições

## Modo DOM/Accessibility

### Navegação por Teclado
- [ ] Simulação de Tab
- [ ] Simulação de Enter
- [ ] Simulação de Escape
- [ ] Simulação de setas

### Análise de Estrutura
- [ ] Identificação de elementos focáveis
- [ ] Ordem de tabulação
- [ ] Rótulos e descrições
- [ ] Estados dos elementos

## Testes

- [ ] Testes unitários frontend
- [ ] Testes unitários backend
- [ ] Testes de integração
- [ ] Testes de automação

## Documentação

- [ ] Guia de uso
- [ ] Documentação de API
- [ ] Exemplos de uso
- [ ] Troubleshooting
