import type { ExtensionMessage, BackendMessage, InternalMessage } from '../shared/types.js';

const BACKEND_URL = 'ws://localhost:8000';
const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 10;

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let sessionId = '';
let connected = false;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return sessionId;
}

function broadcast(msg: InternalMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {/* side panel pode estar fechado */});
}

function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    send({ type: 'ping' });
  }, PING_INTERVAL_MS);
}

function stopPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

export function send(msg: ExtensionMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function isConnected(): boolean {
  return connected;
}

export function connect(): void {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  const url = `${BACKEND_URL}/ws/${getSessionId()}`;
  console.log(`[ws-client] Conectando: ${url}`);
  ws = new WebSocket(url);

  ws.onopen = () => {
    connected = true;
    reconnectAttempts = 0;
    console.log('[ws-client] Conectado');
    startPing();
    broadcast({ type: 'STATUS_UPDATE', payload: { status: 'idle', message: '🔗 Conectado ao backend' } });
  };

  ws.onclose = () => {
    connected = false;
    stopPing();
    broadcast({ type: 'STATUS_UPDATE', payload: { status: 'idle', message: '🔌 Desconectado do backend' } });

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  };

  ws.onerror = (err) => {
    console.warn('[ws-client] Erro:', err);
  };

  ws.onmessage = (event) => {
    let msg: BackendMessage;
    try {
      msg = JSON.parse(event.data as string) as BackendMessage;
    } catch {
      return;
    }
    handleBackendMessage(msg);
  };
}

export function disconnect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  stopPing();
  ws?.close();
  ws = null;
  connected = false;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // previne reconexão automática
}

function handleBackendMessage(msg: BackendMessage) {
  console.log('[ws-client] Recebido:', msg.type);

  switch (msg.type) {
    case 'pong':
      break;

    case 'action_plan':
      // Encaminha o plano para o side panel e para a aba ativa
      broadcast({ type: 'EXECUTE_PLAN', payload: msg.payload });
      break;

    case 'request_snapshot':
      // Backend pede um snapshot → captura a aba ativa
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.runtime.sendMessage({
            type: 'CAPTURE_TREE_FOR_TAB',
            payload: { tabId: tab.id },
          } as InternalMessage);
        }
      });
      break;

    case 'request_screenshot':
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
            if (dataUrl) {
              send({
                type: 'screenshot',
                payload: { snapshotId: 'req', imageBase64: dataUrl.split(',')[1] },
              });
            }
          });
        }
      });
      break;

    case 'task_complete':
      broadcast({
        type: 'STATUS_UPDATE',
        payload: { status: 'idle', message: `✓ Tarefa concluída: ${msg.payload.summary}` },
      });
      broadcast({
        type: 'TAREFA_CONCLUIDA',
        payload: { tarefaId: msg.payload.taskId, resumo: msg.payload.summary },
      });
      break;

    case 'task_error':
      broadcast({
        type: 'STATUS_UPDATE',
        payload: { status: 'error', message: `✗ Erro na tarefa: ${msg.payload.error}` },
      });
      broadcast({
        type: 'TAREFA_ERRO',
        payload: { tarefaId: msg.payload.taskId, erro: msg.payload.error },
      });
      break;
  }
}
