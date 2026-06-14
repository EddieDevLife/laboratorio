# Como Executar o Projeto Mouse Automation

## Opção 1: Executar Localmente (Recomendado para Desenvolvimento)

### Pré-requisitos
- Node.js 18+ instalado
- pnpm instalado (`npm install -g pnpm`)
- Git instalado

### Passos

#### 1. Clonar o Repositório
```bash
git clone https://github.com/Eddie-Tech-AI/laboratorio.git
cd laboratorio
```

#### 2. Instalar Dependências
```bash
pnpm install
```

#### 3. Iniciar Servidor de Desenvolvimento
```bash
pnpm dev
```

O servidor iniciará em `http://localhost:5173`

#### 4. Abrir no Navegador
- Acesse `http://localhost:5173` no seu navegador
- Você verá a página inicial do Vite
- Navegue para a demonstração de acessibilidade

### Testar a Demonstração

1. **Capturar Árvore de Acessibilidade**
   - Clique no botão "📋 Capturar Árvore"
   - Veja no console do navegador (F12) a estrutura capturada

2. **Mover Cursor**
   - Clique em "➡️ Mover para Botão"
   - Observe o cursor vermelho se movendo até o botão "Enviar"
   - Clique em "➡️ Mover para Input"
   - Observe o cursor se movendo até o campo de entrada

3. **Clicar em Elementos**
   - Clique em "🖱️ Clicar em Botão"
   - O cursor se move e clica no botão
   - Clique em "🖱️ Clicar em Input"
   - O cursor se move e clica no campo de entrada

4. **Navegação por Teclado**
   - Clique em "⌨️ Próximo Elemento (Tab)"
   - Observe o foco mudando entre elementos

5. **Executar Sequência**
   - Clique em "▶️ Executar Sequência"
   - Observe uma série de movimentos e cliques automáticos

## Opção 2: Executar no Manus (Sandbox)

Se você quer que eu execute o projeto no sandbox do Manus:

### Passos

1. **Iniciar Servidor**
   ```bash
   cd /home/ubuntu/mouse-automation
   pnpm dev
   ```

2. **Acessar via URL Pública**
   - O servidor será exposto em uma URL pública
   - Você pode acessar de qualquer navegador

## Opção 3: Build para Produção

```bash
# Build
pnpm build

# Visualizar build
pnpm preview
```

## Troubleshooting

### Problema: "pnpm: command not found"
**Solução:**
```bash
npm install -g pnpm
```

### Problema: Porta 5173 já está em uso
**Solução:**
```bash
# Usar porta diferente
pnpm dev -- --port 3000
```

### Problema: Dependências não instalam
**Solução:**
```bash
# Limpar cache
pnpm store prune
pnpm install
```

### Problema: Cursor não aparece
**Solução:**
- Abra o console do navegador (F12)
- Verifique se há erros
- Clique em "📋 Capturar Árvore" primeiro
- Depois clique em "➡️ Mover para Botão"

## Estrutura do Projeto

```
laboratorio/
├── src/
│   ├── components/
│   │   └── AccessibilityDemo.tsx      # Componente de demonstração
│   ├── hooks/
│   │   ├── useAccessibilityTree.ts    # Hook para capturar árvore
│   │   └── useMouseControl.ts         # Hook para controlar mouse
│   ├── styles/
│   │   └── AccessibilityDemo.css      # Estilos
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── package.json
└── README.md
```

## Próximas Etapas

Após validar o projeto funcionando:

1. **Integrar com Backend**
   - Criar servidor Node.js para receber comandos
   - Implementar controle de mouse no sistema operacional

2. **Adicionar Visão Computacional**
   - Integrar captura de screenshots
   - Adicionar detecção de elementos visuais

3. **Melhorar UI**
   - Adicionar mais controles
   - Criar dashboard de monitoramento

4. **Testes**
   - Escrever testes unitários
   - Testar em diferentes navegadores

## Suporte

Se encontrar problemas:

1. Verifique o console do navegador (F12)
2. Verifique os logs do servidor
3. Consulte a documentação em `ACCESSIBILITY_MOUSE_CONTROL_EXAMPLE.md`
4. Abra uma issue no GitHub

## Comandos Úteis

```bash
# Instalar dependências
pnpm install

# Iniciar desenvolvimento
pnpm dev

# Build
pnpm build

# Preview do build
pnpm preview

# Lint
pnpm lint

# Limpar cache
pnpm store prune
```
