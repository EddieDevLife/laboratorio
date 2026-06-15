# Troubleshooting

## Frontend

### `pnpm dev` falha com ERR_MODULE_NOT_FOUND

**Causa:** Node.js v25+ tem resolução de módulos ES diferente.  
**Solução:** os scripts já usam `node node_modules/vite/bin/vite.js` em vez do binário `vite`. Se o problema persistir:

```bash
node --version  # verifique a versão
nvm use 20      # use Node.js 20 LTS
pnpm dev
```

---

### `pnpm install` falha com `Cannot read properties of null (reading 'matches')`

**Causa:** conflito entre `npm` e `pnpm` no mesmo projeto.  
**Solução:** use sempre `pnpm`:

```bash
rm -rf node_modules package-lock.json
pnpm install
```

---

### Tela em branco após `pnpm dev`

1. Abra o console do browser (F12 → Console)
2. Verifique erros de importação ou TypeScript
3. Rode `pnpm typecheck` para ver erros de tipo antes de subir

---

### Screenshot capturado aparece em branco ou corrompido

**Causa:** `html2canvas` não consegue renderizar conteúdo de outros origins (cross-origin).  
**Soluções:**
- Para páginas locais: funciona sem configuração
- Para imagens externas: adicione `crossOrigin="anonymous"` nas tags `<img>`
- Para iframes: não é suportado — use o **Modo Visão Computacional** como alternativa
- Reduza o `scale` se a imagem for muito grande: `{ scale: 1 }` em vez do devicePixelRatio

---

### Análise DOM retorna árvore vazia

**Causa:** `capture()` foi chamado antes do DOM carregar.  
**Solução:** chame após o evento `DOMContentLoaded` ou dentro de um `useEffect`:

```typescript
useEffect(() => {
  capture(); // seguro aqui — DOM já carregou
}, []);
```

---

### Painel de Acessibilidade mostra 0 elementos focáveis

**Causas possíveis:**
1. Página usa apenas elementos `div` sem `tabindex` — não são focáveis por padrão
2. Todos os elementos estão `display: none` ou `visibility: hidden`
3. A página tem `tabindex="-1"` em todos os elementos (remove do fluxo de Tab)

**Debug:** abra o console e rode:
```javascript
document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length
```
Se retornar 0, a página não tem elementos focáveis.

---

## Backend

### Porta 3001 já em uso

```bash
lsof -i :3001          # descobre o processo
kill -9 <PID>          # encerra
cd backend && pnpm dev  # reinicia
```

---

### `ANTHROPIC_API_KEY não configurada`

O backend lança este erro quando a chave não está no ambiente e não foi enviada no body.

**Opção 1 — variável de ambiente:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
cd backend && pnpm dev
```

**Opção 2 — via request:**
```json
{
  "sessionId": "...",
  "instruction": "...",
  "apiKey": "sk-ant-..."
}
```

> ⚠ Nunca commite a chave no código ou em arquivos versionados.

---

### `Anthropic API error 429` (rate limit)

**Causa:** muitas requests em pouco tempo.  
**Soluções:**
- Adicione delay entre chamadas ao `/llm/analyze`
- Use o plano com limites maiores na console Anthropic
- Implemente exponential backoff:

```typescript
async function withRetry(fn: () => Promise<Response>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fn();
    if (res.status !== 429) return res;
    await new Promise(r => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error('Rate limit persistente');
}
```

---

### `Anthropic API error 400` em `/vision/analyze`

**Causa mais comum:** imagem muito grande ou base64 inválido.  
**Soluções:**
- Limite o tamanho: capture em `{ scale: 1 }` (não `window.devicePixelRatio`)
- Verifique que o base64 não contém o prefixo `data:image/png;base64,` — envie só a parte após a vírgula
- Use JPEG para reduzir tamanho: `{ format: 'jpeg', quality: 0.85 }`

---

### Fila de mouse nunca drena (GET /queue retorna sempre vazio)

**Causa:** o poll está sendo feito na sessão errada.  
**Diagnóstico:**
```bash
curl http://localhost:3001/mouse/<sessionId>/stats
```
Se `pending > 0`, verifique se o `sessionId` no poll coincide com o usado no `/batch` ou `/llm/analyze`.

---

### Teste falha com `window is not defined`

**Causa:** teste de hook de browser rodando em ambiente Node.js puro.  
**Solução:** confirme que o `vitest.config.ts` do frontend tem `environment: 'jsdom'`:

```typescript
// vitest.config.ts
export default defineConfig({
  test: { environment: 'jsdom' }
});
```

---

### Testes do backend falham com `Cannot find module '../state/store.js'`

**Causa:** módulos ESM com extensão `.js` precisam da extensão explícita em imports.  
**Solução:** confirme que os imports nos arquivos de source usam `.js`:

```typescript
// ✓ correto
import { saveSnapshot } from '../state/store.js';

// ✗ errado
import { saveSnapshot } from '../state/store';
```

E que o `tsconfig.json` do backend tem `"moduleResolution": "NodeNext"`.

---

### Build falha com erros de TypeScript `noUnusedLocals`

Identifique a variável não usada na mensagem de erro e remova-a ou prefixe com `_`:

```typescript
// Se o retorno não é usado:
void captureResult;  // suprime o erro
// Ou simplesmente não atribua:
capture();           // em vez de const result = capture();
```

---

## Performance

### DOM capture lento em páginas com muitos nós

A captura percorre todo o DOM recursivamente. Para páginas com 10.000+ elementos:

- Use `capture()` em elementos específicos: `buildNode(document.querySelector('main'), 0, stats)`
- Desative a captura automática nas preferências: `autoCapture: false`

### Vision analyze demora muito

O tempo depende da latência da API Anthropic (normalmente 2–8s).  
Para reduzir:
- Reduza o `max_tokens` em `DEFAULT_CONFIG` em [backend/src/llm/client.ts](../backend/src/llm/client.ts)
- Use apenas as tasks necessárias: `"tasks": ["detect_elements"]` (omite OCR, cores, padrões)
- Comprima a imagem antes de enviar: use JPEG com `quality: 0.7`
