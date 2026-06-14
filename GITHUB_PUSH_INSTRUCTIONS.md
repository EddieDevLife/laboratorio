# Instruções para Push ao GitHub

## Passo 1: Criar Repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Nome do repositório: `laboratorio`
3. Descrição: `Mouse Automation System - Desktop automation with mouse control`
4. Escolha: **Public**
5. Clique em "Create repository"

## Passo 2: Fazer Push do Código

Após criar o repositório, execute os comandos abaixo no terminal:

```bash
cd /home/ubuntu/mouse-automation

# Adicionar remote do GitHub
git remote add origin https://github.com/Eddie-Tech-AI/laboratorio.git

# Renomear branch para main (opcional)
git branch -M main

# Fazer push
git push -u origin main
```

## Passo 3: Verificar

Acesse `https://github.com/Eddie-Tech-AI/laboratorio` para verificar se o código foi enviado com sucesso.

## Estrutura do Projeto

```
laboratorio/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── todo.md
```

## Próximas Etapas

Após fazer o push, você pode:

1. Implementar componentes React para captura de DOM
2. Adicionar captura de screenshots
3. Criar backend para controle de mouse
4. Implementar os dois modos de operação

## Dependências Principais

- React 19.2.7
- TypeScript 6.0.3
- Vite 8.0.16
- ESLint 10.5.0

## Como Rodar Localmente

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Build para produção
pnpm build
```
