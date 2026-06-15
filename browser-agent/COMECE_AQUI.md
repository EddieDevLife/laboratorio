# 🎯 COMECE AQUI - Browser Agent Direto

## ✨ O Que Você Tem

Um **Browser Agent autônomo** que:
- ✅ Move o cursor visualmente
- ✅ Clica automaticamente
- ✅ Entende comandos em linguagem natural
- ✅ **SEM SERVIDOR** - conecta direto ao Gemini!

---

## 🚀 3 Passos Rápidos

### **1. Configure a Chave do Gemini**

Obtenha em: https://makersuite.google.com/app/apikey

Depois, abra o console do navegador e execute:
```javascript
chrome.storage.local.set({ geminiApiKey: 'SUA_CHAVE_AQUI' });
```

---

### **2. Carregue a Extensão**

1. Abra: `chrome://extensions/`
2. Ative: **Modo do desenvolvedor**
3. Clique: **Carregar sem compactação**
4. Selecione: `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/dist`

---

### **3. Use!**

1. Clique no ícone da extensão (ou abra Side Panel)
2. Digite: `"vá para google.com"`
3. Veja a mágica acontecer! ✨

---

## 🎮 Comandos Exemplo

```
"vá para youtube.com"
"clique no botão de login"
"digite 'teste' na busca"
"role para baixo"
"encontre o menu"
```

---

## 📚 Documentação Completa

- `CONFIGURACAO_SEM_BACKEND.md` - Guia detalhado
- `GUIA_COMPLETO_USO.md` - Como funciona internamente

---

## 🐛 Problemas?

### **"Gemini API key not configured"**
→ Execute o passo 1 novamente

### **Cursor não aparece**
→ Recarregue a extensão em `chrome://extensions/`

### **Nada acontece**
→ Verifique se está em uma página web normal (não chrome://)

---

## 🎉 Pronto!

Seu Browser Agent está funcionando **sem servidor**! 

**Divirta-se automatizando! 🚀**