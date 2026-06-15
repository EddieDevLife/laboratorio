# 🚀 Guia de Configuração - Modo Direto (SEM Backend)

## 📌 Visão Geral

Este guia mostra como configurar e usar a extensão Browser Agent em **Modo Direto**, sem necessidade de servidor backend Python. A extensão se comunica diretamente com a API do Google Gemini.

### ✅ Vantagens do Modo Direto

- ✅ **Sem servidor**: Não precisa rodar backend Python
- ✅ **Mais rápido**: Comunicação direta com Gemini API
- ✅ **Mais simples**: Apenas configure a chave API e use
- ✅ **Portátil**: Funciona em qualquer máquina com Chrome

---

## 📋 Pré-requisitos

1. **Google Chrome** ou navegador baseado em Chromium
2. **Chave API do Google Gemini** (gratuita)
3. **Node.js** e **npm** instalados (para build da extensão)

---

## 🔑 Passo 1: Obter Chave do Google Gemini

1. Acesse: https://makersuite.google.com/app/apikey
2. Faça login com sua conta Google
3. Clique em **"Create API Key"**
4. Copie a chave gerada (começa com `AIza...`)

**Sua chave já está configurada**: `AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok`

---

## 🛠️ Passo 2: Construir a Extensão

```bash
# Navegue até o diretório da extensão
cd /Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension

# Instale as dependências (se ainda não instalou)
npm install

# Construa a extensão
npm run build
```

**Resultado esperado**:
```
✓ built in XXXms
dist/background/service-worker-direct.js
dist/content/index.js
dist/sidepanel.js
```

---

## 🔧 Passo 3: Configurar a Chave API

### Opção A: Usando o Script de Configuração (Recomendado)

1. Carregue a extensão no Chrome (veja Passo 4)
2. Abra o console do Service Worker:
   - Vá em `chrome://extensions/`
   - Encontre "Browser Agent"
   - Clique em **"service worker"**
3. No console, copie e cole o conteúdo do arquivo `configure-direct-mode.js`:

```javascript
// Sua chave já está configurada no script
const GEMINI_API_KEY = 'AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok';

chrome.storage.local.set({ 
  geminiApiKey: GEMINI_API_KEY,
  directMode: true 
}, () => {
  console.log('✅ Gemini API key configured successfully!');
  console.log('✅ Direct mode activated!');
  console.log('🔄 Please reload the extension to apply changes.');
});
```

4. Pressione Enter
5. Recarregue a extensão

### Opção B: Configuração Manual via Console

No console do Service Worker, execute:

```javascript
chrome.storage.local.set({ 
  geminiApiKey: 'AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok',
  directMode: true 
});
```

---

## 📦 Passo 4: Carregar a Extensão no Chrome

1. Abra o Chrome e vá para: `chrome://extensions/`
2. Ative o **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta: `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/dist`
5. A extensão "Browser Agent" deve aparecer na lista

---

## ✅ Passo 5: Verificar Configuração

### 1. Verificar Service Worker

1. Em `chrome://extensions/`, encontre "Browser Agent"
2. Clique em **"service worker"**
3. O console deve mostrar:

```
Service Worker loaded - Direct Gemini mode
Gemini client initialized
```

### 2. Verificar Chave API

No console do Service Worker, execute:

```javascript
chrome.storage.local.get(['geminiApiKey', 'directMode'], console.log);
```

**Resultado esperado**:
```javascript
{
  geminiApiKey: "AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok",
  directMode: true
}
```

### 3. Verificar Side Panel

1. Clique no ícone da extensão na barra de ferramentas
2. O Side Panel deve abrir
3. No topo, deve mostrar: **"🟢 Modo Direto (Gemini API)"**

---

## 🎮 Como Usar

### 1. Abrir o Side Panel

- Clique no ícone da extensão Browser Agent na barra de ferramentas
- Ou use o atalho (se configurado)

### 2. Executar Comandos

Digite comandos em linguagem natural no campo de entrada:

**Exemplos de comandos**:
```
"vá para google.com"
"pesquise por inteligência artificial"
"clique no primeiro resultado"
"role a página para baixo"
"digite 'teste' no campo de busca"
"clique no botão de login"
```

### 3. Observar Execução

- O cursor virtual aparecerá na página
- A ação será executada automaticamente
- O status será atualizado no Side Panel
- Logs aparecerão na seção de histórico

---

## 🔍 O Que Acontece nos Bastidores

```
┌─────────────────────────────────────────┐
│  1. Você digita comando                 │
│     "vá para google.com"                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Extensão captura:                   │
│     - Screenshot da página              │
│     - Árvore de acessibilidade          │
│     - Elementos interativos             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Chama Gemini API diretamente        │
│     POST https://generativelanguage     │
│          .googleapis.com/v1beta/models  │
│          /gemini-2.0-flash-exp          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Gemini analisa e retorna ação       │
│     {                                   │
│       "action": {                       │
│         "type": "navigate",             │
│         "params": {                     │
│           "url": "https://google.com"   │
│         }                               │
│       }                                 │
│     }                                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Extensão executa ação               │
│     - Move cursor visual                │
│     - Executa navegação/clique/etc      │
│     - Atualiza status                   │
└─────────────────────────────────────────┘
```

---

## 🐛 Solução de Problemas

### ❌ "Chave Gemini não configurada"

**Solução**: Execute o script de configuração (Passo 3)

### ❌ "Failed to fetch" ou erro de API

**Causas possíveis**:
- Chave API inválida ou expirada
- Sem conexão com internet
- Limite de API excedido

**Soluções**:
1. Verifique se a chave está correta
2. Teste sua conexão com internet
3. Verifique quota em: https://makersuite.google.com/

### ❌ Cursor não aparece

**Soluções**:
1. Recarregue a extensão em `chrome://extensions/`
2. Recarregue a página onde está testando
3. Verifique console por erros (F12)

### ❌ "Service Worker loaded" mas sem "Gemini client initialized"

**Solução**: A chave API não foi configurada. Execute o Passo 3 novamente.

### ❌ Nada acontece ao executar comando

**Soluções**:
1. Abra console do Service Worker e procure por erros
2. Verifique se está em uma página web normal (não `chrome://`)
3. Certifique-se de que a chave API está configurada

---

## 📊 Verificação de Status

### Status Esperados no Side Panel

| Status | Significado |
|--------|-------------|
| 🟢 Modo Direto (Gemini API) | Configurado corretamente, pronto para usar |
| ⚠️ Configure Chave Gemini | Chave API não configurada |
| 🔴 Desconectado | Modo backend (não está usando modo direto) |

### Logs Esperados

Ao executar um comando, você deve ver:

```
[HH:MM:SS] 🚀 Executando: "vá para google.com"
[HH:MM:SS] 📸 Capturando página...
[HH:MM:SS] ✓ Comando enviado ao Gemini
[HH:MM:SS] ✓ Ação concluída
```

---

## 🎯 Comandos de Teste

Use estes comandos para testar a extensão:

### Teste 1: Navegação Simples
```
"vá para google.com"
```
**Esperado**: Navegador vai para google.com

### Teste 2: Busca
```
"pesquise por inteligência artificial"
```
**Esperado**: Digita no campo de busca e pressiona Enter

### Teste 3: Clique
```
"clique no primeiro link"
```
**Esperado**: Cursor move e clica no primeiro link da página

### Teste 4: Scroll
```
"role a página para baixo"
```
**Esperado**: Página rola para baixo

---

## 🔐 Segurança da Chave API

### ⚠️ Importante

- **NÃO compartilhe** sua chave API publicamente
- **NÃO faça commit** da chave em repositórios Git
- A chave fica armazenada localmente no Chrome Storage
- Apenas a extensão tem acesso à chave

### Rotação de Chave

Se precisar trocar a chave:

1. Gere nova chave em: https://makersuite.google.com/app/apikey
2. Execute o script de configuração com a nova chave
3. Recarregue a extensão

---

## 📈 Limites da API Gemini

### Plano Gratuito

- **60 requisições por minuto**
- **1500 requisições por dia**
- Suficiente para uso pessoal e testes

### Monitorar Uso

Acesse: https://makersuite.google.com/
- Veja quantas requisições você fez
- Monitore quota restante
- Upgrade para plano pago se necessário

---

## 🎉 Pronto para Usar!

Agora você tem um **Browser Agent totalmente funcional** que:

- ✅ Funciona sem servidor backend
- ✅ Usa Gemini API diretamente
- ✅ Executa comandos em linguagem natural
- ✅ Move cursor visualmente
- ✅ Automatiza ações no navegador

**Divirta-se automatizando! 🚀**

---

## 📚 Próximos Passos

### Recursos Avançados

1. **Criar macros**: Grave sequências de comandos
2. **Modo autônomo**: Execute múltiplas ações automaticamente
3. **Integração com outras ferramentas**: Use com scripts externos

### Melhorias Futuras

- Interface gráfica para configurar chave API
- Histórico persistente de comandos
- Exportar/importar configurações
- Suporte a múltiplos perfis

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no console do Service Worker
2. Consulte a seção de Solução de Problemas
3. Verifique se a chave API está válida
4. Teste com comandos simples primeiro

---

**Desenvolvido com ❤️ - Browser Agent Direct Mode**