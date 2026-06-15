import { getAutomationTree } from './automation-bridge.js';
import { getCDPAccessibilityTree } from './debugger-bridge.js';
import { connect, disconnect, send, isConnected } from './ws-client.js';
import type { InternalMessage, PageSnapshot } from '../shared/types.js';

// Abre o side panel ao clicar no ícone
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// ─── Listener principal ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: InternalMessage, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // canal assíncrono
  }
);

// ─── Listener para mensagens externas (React app) ─────────────────────────────

chrome.runtime.onMessageExternal.addListener(
  (message: any, sender, sendResponse) => {
    handleExternalMessage(message, sender, sendResponse);
    return true; // canal assíncrono
  }
);

async function handleMessage(
  message: InternalMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r?: unknown) => void
) {
  switch (message.type) {
    // ── Pedido do side panel ───────────────────────────────────────────────────
    case 'CAPTURE_TREE_FOR_TAB': {
      const { tabId } = message.payload;
      await captureAndBroadcast(tabId, sender);
      sendResponse({ ok: true });
      break;
    }

    // ── Resposta do content script (fallback DOM) ──────────────────────────────
    case 'TREE_CAPTURED': {
      broadcastToSidePanel(message);
      sendResponse({ ok: true });
      break;
    }

    // ── Controle WebSocket ────────────────────────────────────────────────────
    case 'WS_CONNECT':
      connect();
      sendResponse({ ok: true });
      break;

    case 'WS_DISCONNECT':
      disconnect();
      sendResponse({ ok: true });
      break;

    case 'WS_SEND_SNAPSHOT': {
      const { tabId } = (message as Extract<InternalMessage, { type: 'WS_SEND_SNAPSHOT' }>).payload;
      // Captura snapshot e envia ao backend via WebSocket
      await captureAndSendToBackend(tabId);
      sendResponse({ ok: true });
      break;
    }

    case 'WS_ENVIAR_COMANDO': {
      const { tarefaId, comando, tabId } = (message as Extract<InternalMessage, { type: 'WS_ENVIAR_COMANDO' }>).payload;
      
      // Conecta ao backend se não estiver conectado
      if (!isConnected()) {
        connect();
        await delay(1000);
      }

      // Envia comando ao backend
      broadcastToSidePanel({
        type: 'STATUS_UPDATE',
        payload: { status: 'running', message: '🔍 Analisando comando...' }
      });

      send({
        type: 'task_start',
        payload: {
          taskId: tarefaId,
          objective: comando,
          autonomyLevel: 'semi'
        }
      });

      // Captura e envia snapshot da aba
      await captureAndSendToBackend(tabId);
      
      sendResponse({ ok: true });
      break;
    }

    // ── Screenshot pedido pelo content script ──────────────────────────────────
    case 'TAKE_SCREENSHOT': {
      const tabId = sender.tab?.id;
      if (!tabId) { sendResponse({ error: 'Sem tabId' }); return; }
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(
          sender.tab!.windowId!,
          { format: 'png' }
        );

// ─── Handler para mensagens externas (React app) ──────────────────────────────

async function handleExternalMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r?: unknown) => void
) {
  console.log('[service-worker] External message:', message.type, 'from:', sender.url);

  switch (message.type) {
    // ── Ping para verificar conexão ────────────────────────────────────────────
    case 'PING': {
      sendResponse({
        success: true,
        version: chrome.runtime.getManifest().version,
        extensionId: chrome.runtime.id
      });
      break;
    }

    // ── Capturar árvore de acessibilidade ──────────────────────────────────────
    case 'CAPTURE_TREE': {
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs[0]?.id) {
          await captureAndBroadcast(tabs[0].id, sender);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      break;
    }

    // ── Capturar screenshot ────────────────────────────────────────────────────
    case 'TAKE_SCREENSHOT': {
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs[0]?.id && tabs[0]?.windowId) {
          const dataUrl = await chrome.tabs.captureVisibleTab(
            tabs[0].windowId,
            { format: 'png' }
          );
          sendResponse({ success: true, screenshot: dataUrl });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      break;
    }

    // ── Obter informações da aba ativa ─────────────────────────────────────────
    case 'GET_CURRENT_TAB': {
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs[0]) {
          sendResponse({
            success: true,
            tab: {
              id: tabs[0].id,
              url: tabs[0].url,
              title: tabs[0].title
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      break;
    }

    // ── Executar comando AI ────────────────────────────────────────────────────
    case 'EXECUTE_COMMAND': {
      const { command, taskObjective } = message.payload || {};
      if (!command) {
        sendResponse({ success: false, error: 'No command provided' });
        break;
      }

      try {
        // Conecta ao backend se não estiver conectado
        if (!isConnected()) {
          connect();
          await delay(1000); // Aguarda conexão
        }

        // Envia comando ao backend
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs[0]?.id) {
          const taskId = `task-${Date.now()}`;
          send({
            type: 'task_start',
            payload: {
              taskId,
              objective: taskObjective || command,
              autonomyLevel: 'semi'
            }
          });

          // Captura e envia snapshot
          await captureAndSendToBackend(tabs[0].id);
          
          sendResponse({ success: true, taskId });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      break;
    }

    // ── Status da extensão ─────────────────────────────────────────────────────
    case 'GET_STATUS': {
      sendResponse({
        success: true,
        status: {
          connected: isConnected(),
          version: chrome.runtime.getManifest().version,
          extensionId: chrome.runtime.id
        }
      });
      break;
    }

    default:
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
  }
}
        sendResponse({ ok: true, imageBase64: dataUrl.split(',')[1] });
      } catch (err) {
        sendResponse({ error: String(err) });
      }
      break;
    }

    default:
      sendResponse({ ok: false, error: `Tipo desconhecido: ${(message as { type: string }).type}` });
  }
}

// ─── Lógica de captura com fallback em cascata ────────────────────────────────
//
// Prioridade: chrome.automation (screen reader API) → CDP → DOM traversal
//
async function captureAndBroadcast(tabId: number, sender: chrome.runtime.MessageSender) {
  // Tenta obter informações da aba para o snapshot
  let tab: chrome.tabs.Tab | undefined;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    broadcastError(tabId, 'Não foi possível acessar a aba. Recarregue a página.');
    return;
  }

  // ── 1. chrome.automation (API de leitores de tela) ────────────────────────
  const automationTree = await getAutomationTree(tabId);
  if (automationTree) {
    const snapshot: PageSnapshot = {
      snapshotId: `snap-${Date.now()}`,
      tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      timestamp: Date.now(),
      tree: automationTree,
      source: 'cdp', // reutilizando 'cdp' como 'não-dom'; será 'automation' na Fase 2
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    };
    // Enriquece com dados de scroll/viewport via content script (sem bloquear)
    chrome.tabs.sendMessage(tabId, { type: 'ENRICH_SNAPSHOT', payload: snapshot } as InternalMessage)
      .catch(() => broadcastToSidePanel({ type: 'TREE_CAPTURED', payload: snapshot }));
    return;
  }

  // ── 2. CDP via chrome.debugger ─────────────────────────────────────────────
  const cdpTree = await getCDPAccessibilityTree(tabId);
  if (cdpTree) {
    const snapshot: PageSnapshot = {
      snapshotId: `snap-${Date.now()}`,
      tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      timestamp: Date.now(),
      tree: cdpTree,
      source: 'cdp',
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    };
    chrome.tabs.sendMessage(tabId, { type: 'ENRICH_SNAPSHOT', payload: snapshot } as InternalMessage)
      .catch(() => broadcastToSidePanel({ type: 'TREE_CAPTURED', payload: snapshot }));
    return;
  }

  // ── 3. DOM traversal via content script ────────────────────────────────────
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CAPTURE_TREE',
      payload: { tabId },
    } as InternalMessage);
    // O content script vai enviar TREE_CAPTURED ao runtime → SW re-emite ao side panel
  } catch {
    // Content script não carregado — tenta injetar via scripting API
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/index.js'],
      });
      // Aguarda um tick e tenta novamente
      await delay(500);
      await chrome.tabs.sendMessage(tabId, {
        type: 'CAPTURE_TREE',
        payload: { tabId },
      } as InternalMessage);
    } catch (injectErr) {
      broadcastError(tabId, `Não foi possível injetar o script na página. Recarregue a aba e tente novamente. (${String(injectErr)})`);
    }
  }
}

function broadcastToSidePanel(message: InternalMessage) {
  chrome.runtime.sendMessage(message).catch(() => {/* side panel pode estar fechado */});
}

function broadcastError(tabId: number, error: string) {
  broadcastToSidePanel({ type: 'CAPTURE_ERROR', payload: { error } });
  console.error(`[browser-agent][tab:${tabId}] ${error}`);
}

// Captura snapshot e envia ao backend via WebSocket (Fase 2+)
async function captureAndSendToBackend(tabId: number) {
  if (!isConnected()) {
    broadcastError(tabId, 'WebSocket não conectado. Clique em "Conectar Backend" primeiro.');
    return;
  }

  let tab: chrome.tabs.Tab | undefined;
  try { tab = await chrome.tabs.get(tabId); } catch { return; }

  const tree =
    (await getAutomationTree(tabId)) ??
    (await getCDPAccessibilityTree(tabId));

  if (tree) {
    const snapshot: PageSnapshot = {
      snapshotId: `snap-${Date.now()}`,
      tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      timestamp: Date.now(),
      tree,
      source: 'cdp',
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    };
    send({ type: 'snapshot', payload: snapshot });
    broadcastToSidePanel({ type: 'STATUS_UPDATE', payload: { status: 'waiting', message: '📤 Snapshot enviado ao backend' } });
  } else {
    broadcastError(tabId, 'Não foi possível capturar a árvore para envio ao backend.');
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
