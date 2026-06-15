/**
 * Service Worker — sem backend, chama a LLM API diretamente.
 * Suporta Anthropic, OpenAI e Gemini via llm-client.ts
 */

/// <reference types="chrome"/>

import { AgentLoop } from './agent-loop.js';
import type { InternalMessage } from '../shared/types.js';

// ── Estado global ─────────────────────────────────────────────────────────────

let currentLoop: AgentLoop | null = null;

// ── Listeners ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[BrowserAgent] Extensão instalada — modo direto (sem backend).');
});

chrome.runtime.onMessage.addListener(
  (msg: InternalMessage, _sender, sendResponse) => {
    handleMessage(msg, sendResponse);
    return true;
  }
);

// ── Handler principal ─────────────────────────────────────────────────────────

async function handleMessage(msg: InternalMessage, reply: (r: unknown) => void) {
  const type = (msg as { type: string }).type;

  switch (type) {

    // Side panel inicia uma tarefa em linguagem natural
    case 'START_TASK': {
      const { tabId, objective } = (msg as { type: string; payload: { tabId: number; objective: string } }).payload;
      if (currentLoop) currentLoop.stop();

      currentLoop = new AgentLoop({
        tabId,
        objective,
        onStatusChange: (state) => {
          chrome.runtime.sendMessage({
            type: 'AGENT_STATE',
            payload: state,
          }).catch(() => {});
        },
      });

      currentLoop.run().finally(() => { currentLoop = null; });
      reply({ ok: true });
      break;
    }

    // Side panel para a tarefa
    case 'STOP_TASK': {
      currentLoop?.stop();
      currentLoop = null;
      reply({ ok: true });
      break;
    }

    // Resposta do usuário para ação destrutiva (confirmação via ConfirmationModal)
    case 'CONFIRM_ACTION': {
      const { confirmed } = (msg as { type: string; payload: { confirmed: boolean } }).payload;
      currentLoop?.resolveConfirmation(confirmed);
      reply({ ok: true });
      break;
    }

    // Scan manual de acessibilidade da aba
    case 'CAPTURE_TREE_FOR_TAB': {
      const { tabId } = (msg as { type: string; payload: { tabId: number } }).payload;
      await injectContentIfNeeded(tabId);
      chrome.tabs.sendMessage(
        tabId,
        { type: 'CAPTURE_TREE', payload: { tabId } } as InternalMessage,
        (res) => reply(res ?? { error: 'sem resposta do content script' })
      );
      break;
    }

    // Passagem transparente de eventos para o side panel
    case 'TREE_CAPTURED':
    case 'ACTION_RESULT':
    case 'STATUS_UPDATE':
      chrome.runtime.sendMessage(msg).catch(() => {});
      reply({ ok: true });
      break;

    default:
      reply({ ok: false, error: `Tipo desconhecido: ${type}` });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function injectContentIfNeeded(tabId: number): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: '__PING__' } as unknown as InternalMessage, (res) => {
        if (chrome.runtime.lastError || !res) reject(new Error('not injected'));
        else resolve();
      });
    });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    });
  }
}
