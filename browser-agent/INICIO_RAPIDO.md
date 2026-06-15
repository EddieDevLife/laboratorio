# 🚀 Início Rápido - 3 Passos Simples

## ✅ Passo 1: Carregar a Extensão

1. Abra o Chrome
2. Digite na barra de endereço: `chrome://extensions/`
3. Ative o **"Modo do desenvolvedor"** (canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Selecione a pasta: `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/dist`

✅ A extensão "Browser Agent" deve aparecer na lista!

---

## ✅ Passo 2: Configurar Chave API

### Método 1: Página de Configuração (MAIS FÁCIL) ⭐

1. Abra uma nova aba no Chrome
2. Digite: `chrome-extension://[ID_DA_EXTENSAO]/setup-api-key.html`
   - **OU** navegue até: `/Users/edersonbarreto/Desktop/gen-AI/browser-agent/extension/dist/setup-api-key.html`
3. Clique no botão: **"✅ Configurar com Chave Padrão"**
4. Aguarde a mensagem de sucesso
5. Recarregue a extensão em `chrome://extensions/`

### Método 2: Console do Service Worker

1. Em `chrome://extensions/`, encontre "Browser Agent"
2. Clique em **"service worker"** (abre console)
3. Cole e execute este código:

```javascript
chrome.storage.local.set({ 
  geminiApiKey: 'AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok',
  directMode: true 
}, () => {
  console.log('✅ Configurado!');
  console.log('🔄 Recarregue a extensão agora');
});
```

4. Pressione Enter
5. Recarregue a extensão (botão de reload em `chrome://extensions/`)

---

## ✅ Passo 3: Testar

1. **Clique no ícone da extensão** na barra de ferramentas do Chrome
2. O Side Panel deve abrir
3. **Verifique o status no topo**:
   - ✅ Deve mostrar: **"🟢 Modo Direto (Gemini API)"**
   - ❌ Se mostrar "⚠️ Configure Chave Gemini", volte ao Passo 2

4. **Digite um comando de teste**:
   ```
   vá para google.com
   ```

5. **Clique em "Executar"**

6. **Resultado esperado**:
   - Navegador vai para google.com
   - Logs aparecem no painel
   - Status muda para "Executando..."

---

## 🎯 Comandos para Testar

Depois que funcionar, teste estes comandos:

```
"vá para youtube.com"
"pesquise por inteligência artificial"
"clique no primeiro link"
"role a página para baixo"
```

---

## 🐛 Problemas?

### ❌ Ainda mostra "🔴 Desconectado"

**Solução**: 
1. Verifique se executou o Passo 2 corretamente
2. Recarregue a extensão em `chrome://extensions/`
3. Feche e abra o Side Panel novamente

### ❌ "⚠️ Configure Chave Gemini"

**Solução**: A chave não foi salva. Execute o Passo 2 novamente.

### ❌ Erro ao executar comando

**Solução**:
1. Abra o console do Service Worker
2. Procure por erros em vermelho
3. Verifique se tem internet
4. Teste com comando mais simples: `"vá para google.com"`

---

## 📊 Como Verificar se Está Configurado

No console do Service Worker, execute:

```javascript
chrome.storage.local.get(['geminiApiKey', 'directMode'], console.log);
```

**Deve retornar**:
```javascript
{
  geminiApiKey: "AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok",
  directMode: true
}
```

Se retornar `{}` (vazio), a chave não foi configurada.

---

## ✨ Pronto!

Agora você tem um Browser Agent funcionando em modo direto! 🎉

**Não precisa de servidor backend Python!**

---

## 📚 Documentação Completa

Para mais detalhes, veja:
- [`MODO_DIRETO_SETUP.md`](MODO_DIRETO_SETUP.md) - Guia completo
- [`RESUMO_MODO_DIRETO.md`](RESUMO_MODO_DIRETO.md) - Resumo técnico
- [`CONFIGURACAO_SEM_BACKEND.md`](CONFIGURACAO_SEM_BACKEND.md) - Guia original

---

**Desenvolvido com ❤️ - Browser Agent Direct Mode**