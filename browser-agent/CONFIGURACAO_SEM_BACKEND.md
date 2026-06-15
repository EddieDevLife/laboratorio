# 🚀 Configuração Simples - SEM Backend!

## ✨ O Que Mudou

Agora a extensão **NÃO PRECISA** de servidor backend! 

- ❌ **Antes**: Extensão → Backend Python → Gemini API
- ✅ **Agora**: Extensão → Gemini API (direto!)

**Vantagens**:
- Sem servidor para rodar
- Mais rápido
- Mais simples
- Funciona offline (exceto chamadas à API)

---

## 📋 Passo a Passo

### **1️⃣ Obter Chave do Google Gemini**

1. Acesse: https://makersuite.google.com/app/apikey
2. Clique em **"Create API Key"**
3. Copie a chave (começa com `AIza...`)

---

### **2️⃣ Configurar a Extensão**

#### **Opção A: Via Código (Recomendado)**

Edite o arquivo:
```
/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/src/background/service-worker-direct.ts
```

Na linha 17, adicione sua chave:
```typescript
// Substitua 'SUA_CHAVE_AQUI' pela chave real
const DEFAULT_API_KEY = 'AIzaSy...sua_chave_aqui';
```

#### **Opção B: Via Chrome Storage (Mais Seguro)**

Depois de carregar a extensão:
1. Abra o console do service worker
2. Execute:
```javascript
chrome.storage.local.set({ geminiApiKey: 'AIzaSy...sua_chave_aqui' });
```

---

### **3️⃣ Atualizar Vite Config**

Edite `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker-direct.ts'),
        'content/index': resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

---

### **4️⃣ Reconstruir a Extensão**

```bash
cd /Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension
npm run build
```

**Deve ver**:
```
✓ built in XXXms
dist/background/service-worker.js
dist/content/index.js
dist/sidepanel.js
```

---

### **5️⃣ Carregar no Chrome**

1. Abra: `chrome://extensions/`
2. Ative: **Modo do desenvolvedor**
3. Clique: **Carregar sem compactação**
4. Selecione: `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/dist`

---

### **6️⃣ Testar**

1. Abra o Side Panel (clique no ícone da extensão)
2. Digite um comando: `"vá para google.com"`
3. **Observe**: 
   - Cursor se move
   - Ação é executada
   - Sem servidor rodando!

---

## 🎮 Como Usar

### **Comandos Exemplo**

```
"vá para youtube.com"
"clique no botão de login"
"digite 'teste' na busca"
"role para baixo"
"encontre o menu"
```

### **O Que Acontece**

1. Você digita comando
2. Extensão captura screenshot + elementos da página
3. Chama Gemini API diretamente
4. Gemini analisa e decide próxima ação
5. Cursor se move e executa
6. ✅ Pronto!

---

## 🔍 Verificar se Está Funcionando

### **1. Verificar Service Worker**

1. Vá em `chrome://extensions/`
2. Encontre "Browser Agent"
3. Clique em **"service worker"**
4. Console deve mostrar:
```
Service Worker loaded - Direct Gemini mode
Gemini client initialized
```

### **2. Verificar Chave API**

No console do service worker:
```javascript
chrome.storage.local.get(['geminiApiKey'], (r) => console.log(r));
```

Deve retornar:
```javascript
{ geminiApiKey: "AIzaSy..." }
```

### **3. Testar Comando**

1. Abra Side Panel
2. Digite: `"vá para google.com"`
3. Veja logs no console do service worker

---

## 🐛 Troubleshooting

### **Erro: "Gemini API key not configured"**

**Solução**: Configure a chave API (veja passo 2)

---

### **Erro: "Failed to fetch"**

**Causas possíveis**:
- Chave API inválida
- Sem internet
- Limite de API excedido

**Solução**:
1. Verifique a chave
2. Teste conexão
3. Veja quota em: https://makersuite.google.com/

---

### **Cursor não aparece**

**Solução**:
1. Recarregue a extensão
2. Recarregue a página
3. Verifique console por erros

---

### **Nada acontece**

**Solução**:
1. Abra console do service worker
2. Procure por erros
3. Verifique se está em página web normal (não chrome://)

---

## 📊 Arquitetura Simplificada

```
┌─────────────────────────────────────┐
│         CHROME BROWSER              │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Browser Agent Extension    │  │
│  │                              │  │
│  │  ┌────────────────────────┐  │  │
│  │  │   Service Worker       │  │  │
│  │  │   (Direct Gemini)      │  │  │
│  │  │                        │  │  │
│  │  │  - Recebe comandos     │  │  │
│  │  │  - Captura página      │  │  │
│  │  │  - Chama Gemini API    │  │  │
│  │  │  - Executa ações       │  │  │
│  │  └────────┬───────────────┘  │  │
│  │           │                  │  │
│  │  ┌────────▼───────────────┐  │  │
│  │  │   Content Scripts      │  │  │
│  │  │                        │  │  │
│  │  │  - Cursor visual       │  │  │
│  │  │  - Cliques automáticos │  │  │
│  │  │  - Digitação           │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└─────────────────┼───────────────────┘
                  │
                  │ HTTPS
                  │
     ┌────────────▼────────────┐
     │   Google Gemini API     │
     │   (generativelanguage   │
     │    .googleapis.com)     │
     └─────────────────────────┘
```

**Sem servidor intermediário!** 🎉

---

## ✅ Checklist Final

Antes de usar:

- [ ] Chave do Gemini obtida
- [ ] Chave configurada na extensão
- [ ] Extensão reconstruída (`npm run build`)
- [ ] Extensão carregada no Chrome
- [ ] Service worker mostra "Gemini client initialized"
- [ ] Testei comando simples

---

## 🎉 Pronto!

Agora você tem um **Browser Agent totalmente autônomo** que:

- ✅ Funciona sem servidor
- ✅ Chama Gemini diretamente
- ✅ Move cursor visualmente
- ✅ Executa ações automaticamente
- ✅ Entende comandos em linguagem natural

**Divirta-se automatizando! 🚀**

---

## 📚 Próximos Passos

### **Melhorias Possíveis**:

1. **Interface para configurar chave**
   - Criar página de opções
   - Salvar chave de forma segura

2. **Histórico de comandos**
   - Salvar comandos executados
   - Repetir comandos anteriores

3. **Modo totalmente autônomo**
   - Executar múltiplas ações em sequência
   - Loop de feedback automático

4. **Gravação de macros**
   - Gravar sequência de ações
   - Reproduzir depois

---

**Feito com ❤️ - Browser Agent Direct Mode**