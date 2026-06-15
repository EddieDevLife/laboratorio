import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PageSnapshot,
  AccessibilityNode,
  AgentStatus,
  AgentState,
  InternalMessage,
} from '../shared/types.js';
import { collectFocusable } from '../shared/types.js';
import AgentStatusBadge from './components/AgentStatus.js';
import TreeNode from './components/TreeNode.js';
import { ConfirmationModal } from './ConfirmationModal.js';
import { useAnnouncer } from './hooks/useAnnouncer.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { speak } from './tts/index.js';
import { PROVIDERS } from '../background/llm-client.js';
import type { Provider, StoredSettings } from '../background/llm-client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry { time: string; text: string; error: boolean }

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
  const [focusable, setFocusable] = useState<AccessibilityNode[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [objective, setObjective] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);

  const [settings, setSettings] = useState<StoredSettings>({
    llm_provider: 'gemini',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [activeTab, setActiveTab] = useState<{ url: string; title: string; id: number } | null>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const running = agentStatus === 'running' || agentStatus === 'scanning';
  const tabIsValid = !!activeTab && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://');

  const { announce } = useAnnouncer();

  // ── Monitor active tab ────────────────────────────────────────────────────

  useEffect(() => {
    async function refreshTab() {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id && tab.url && tab.title) {
        setActiveTab({ url: tab.url, title: tab.title, id: tab.id });
      }
    }
    function onUpdated(_id: number, info: chrome.tabs.TabChangeInfo) {
      if (info.status === 'complete') refreshTab();
    }
    refreshTab();
    chrome.tabs.onActivated.addListener(refreshTab);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(refreshTab);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // ── Load settings on mount ────────────────────────────────────────────────

  useEffect(() => {
    const keys = [
      'llm_provider', 'custom_name', 'custom_base_url',
      ...PROVIDERS.flatMap((p) => [`${p.id}_api_key`, `${p.id}_model`]),
    ];
    chrome.storage.local.get(keys, (result) => {
      setSettings((prev) => ({ ...prev, ...result } as StoredSettings));
    });
  }, []);

  // ── Messages from service worker ──────────────────────────────────────────

  useEffect(() => {
    function onMessage(msg: InternalMessage & { type: string; payload?: unknown }) {
      if (msg.type === 'TREE_CAPTURED') {
        const snap = (msg as { type: string; payload: PageSnapshot }).payload;
        const fc = collectFocusable(snap.tree);
        setSnapshot(snap);
        setFocusable(fc);
        setAgentStatus('idle');
        addLog(`Árvore capturada via ${snap.source.toUpperCase()} — ${fc.length} elementos`);
      }

      if (msg.type === 'CAPTURE_ERROR') {
        setAgentStatus('error');
        addLog((msg as { type: string; payload: { error: string } }).payload.error, true);
      }

      if (msg.type === 'STATUS_UPDATE') {
        const p = (msg as { type: string; payload: { status: AgentStatus; message?: string } }).payload;
        if (p.status === 'running') setAgentStatus('running');
        else if (p.status === 'error') setAgentStatus('error');
        else setAgentStatus('idle');
        if (p.message) addLog(p.message);
      }

      if (msg.type === 'AGENT_STATE') {
        const state = (msg as { type: string; payload: AgentState }).payload;
        setAgentState(state);

        if (state.status === 'running') setAgentStatus('running');
        else if (state.status === 'error') {
          setAgentStatus('error');
          if (state.error) addLog(state.error, true);
        } else setAgentStatus('idle');

        // Narração via TTS + ARIA
        if (state.narration) {
          const priority = state.isDestructive ? 'assertive' : 'polite';
          speak(state.narration, priority).catch(() => {});
          announce(state.narration, priority);
          addLog(state.narration);
        }

        // Mostrar modal de confirmação para ações destrutivas
        if (state.isDestructive && state.lastAction) {
          setPendingConfirmation(state.narration || state.lastAction);
        }

        if (state.status === 'done') {
          speak('Tarefa concluída', 'assertive').catch(() => {});
          announce('Tarefa concluída', 'assertive');
        }
      }

      if (msg.type === 'ACTION_RESULT') {
        const r = (msg as { type: string; payload: { success: boolean; error?: string } }).payload;
        addLog(r.success ? 'Ação executada' : `Falha: ${r.error}`, !r.success);
      }
    }

    chrome.runtime.onMessage.addListener(
      onMessage as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
    );
    return () => chrome.runtime.onMessage.removeListener(
      onMessage as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
    );
  }, [announce]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function addLog(text: string, error = false) {
    const time = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setLog((prev) => [{ time, text, error }, ...prev].slice(0, 80));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const startTask = useCallback(async () => {
    if (!objective.trim()) return;

    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) { addLog('Nenhuma aba ativa', true); return; }
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      addLog('Páginas chrome:// não são acessíveis', true);
      return;
    }

    const activeKey = activeApiKey();
    if (!activeKey) {
      addLog(`Chave de API não configurada para "${settings.llm_provider}". Abra Configurações.`, true);
      setShowSettings(true);
      return;
    }

    setAgentStatus('running');
    setAgentState({ status: 'running', step: 0, lastAction: 'Iniciando...', narration: 'Iniciando tarefa' });
    addLog(`Iniciando tarefa: "${objective.trim()}"`);
    speak(`Iniciando tarefa: ${objective.trim()}`).catch(() => {});
    announce(`Iniciando tarefa: ${objective.trim()}`);

    chrome.runtime.sendMessage({
      type: 'START_TASK',
      payload: { tabId: tab.id, objective: objective.trim() },
    } as unknown as InternalMessage);

    setObjective('');
  }, [objective, settings, announce]);

  const stopTask = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'STOP_TASK' } as unknown as InternalMessage);
    setAgentStatus('idle');
    setAgentState(null);
    setPendingConfirmation(null);
    addLog('Tarefa interrompida pelo usuário');
    speak('Tarefa interrompida', 'assertive').catch(() => {});
    announce('Tarefa interrompida', 'assertive');
  }, [announce]);

  const confirmAction = useCallback(() => {
    setPendingConfirmation(null);
    chrome.runtime.sendMessage({
      type: 'CONFIRM_ACTION',
      payload: { confirmed: true },
    } as unknown as InternalMessage);
    speak('Confirmado. Executando.', 'polite').catch(() => {});
    announce('Confirmado. Executando.');
  }, [announce]);

  const cancelAction = useCallback(() => {
    setPendingConfirmation(null);
    chrome.runtime.sendMessage({
      type: 'CONFIRM_ACTION',
      payload: { confirmed: false },
    } as unknown as InternalMessage);
    speak('Ação cancelada.', 'assertive').catch(() => {});
    announce('Ação cancelada.', 'assertive');
  }, [announce]);

  const scanPage = useCallback(async () => {
    setAgentStatus('scanning');
    setSnapshot(null);
    setFocusable([]);
    addLog('Escaneando...');
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) { addLog('Nenhuma aba ativa', true); setAgentStatus('error'); return; }
    if (tab.url?.startsWith('chrome://')) { addLog('chrome:// não acessível', true); setAgentStatus('error'); return; }
    chrome.runtime.sendMessage({
      type: 'CAPTURE_TREE_FOR_TAB',
      payload: { tabId: tab.id },
    } as InternalMessage, (res) => {
      if (chrome.runtime.lastError) { addLog(chrome.runtime.lastError.message ?? 'erro', true); setAgentStatus('error'); }
      else if (res?.error) { addLog(res.error, true); setAgentStatus('error'); }
    });
  }, []);

  const saveSettings = useCallback(async () => {
    await chrome.storage.local.set(settings);
    setSettingsSaved(true);
    addLog('Configurações salvas');
    setTimeout(() => setSettingsSaved(false), 2000);
  }, [settings]);

  function activeApiKey(): string {
    const id = settings.llm_provider ?? 'openai';
    return (settings[`${id}_api_key`] as string | undefined) ?? '';
  }

  const activeProviderDef = PROVIDERS.find((p) => p.id === (settings.llm_provider ?? 'openai'));

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useKeyboardShortcuts({
    'ctrl+enter': () => { if (!running && tabIsValid) startTask(); },
    'escape': () => { if (running) stopTask(); else if (pendingConfirmation) cancelAction(); },
    'alt+t': () => objectiveRef.current?.focus(),
    'alt+s': () => setShowSettings((s) => !s),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* ARIA live regions (invisible to sighted users, read by screen readers) */}
      <div id="agent-live-polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="agent-live-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />

      {/* Confirmation modal for destructive actions */}
      {pendingConfirmation && (
        <ConfirmationModal
          action={pendingConfirmation}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      )}

      {/* Header */}
      <div className="header">
        <h1>Browser Agent</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AgentStatusBadge status={agentStatus} />
          <button
            onClick={() => setShowSettings((s) => !s)}
            title="Configurações (Alt+S)"
            aria-expanded={showSettings}
            aria-label="Configurações"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: showSettings ? 'var(--blue)' : 'var(--text2)' }}
          >⚙️</button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel" style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13 }}>Configurações de LLM</h3>

          {/* Provider selector */}
          <label style={{ fontSize: 12 }}>
            Provedor
            <select
              value={settings.llm_provider ?? 'gemini'}
              onChange={(e) => setSettings((s) => ({ ...s, llm_provider: e.target.value as Provider }))}
              style={{ width: '100%', marginTop: 4 }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {/* Custom provider: name + base URL */}
          {settings.llm_provider === 'custom' && (
            <>
              <label style={{ fontSize: 12 }}>
                Nome do provedor
                <input type="text" placeholder="Ex: Ollama, LM Studio, Together AI..."
                  value={settings.custom_name ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, custom_name: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12 }}>
                URL base (OpenAI-compatível)
                <input type="text" placeholder="https://api.example.com/v1"
                  value={settings.custom_base_url ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, custom_base_url: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }} />
              </label>
            </>
          )}

          {/* API Key — dinâmica por provedor */}
          {activeProviderDef && (
            <label style={{ fontSize: 12 }}>
              {activeProviderDef.id === 'custom'
                ? 'API Key'
                : `${activeProviderDef.name} API Key`}
              <input
                type="password"
                placeholder={activeProviderDef.apiKeyPlaceholder}
                value={(settings[`${activeProviderDef.id}_api_key`] as string | undefined) ?? ''}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  [`${activeProviderDef.id}_api_key`]: e.target.value,
                }))}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          )}

          {/* Model override */}
          {activeProviderDef && (
            <label style={{ fontSize: 12 }}>
              Modelo{activeProviderDef.defaultModel ? ` (padrão: ${activeProviderDef.defaultModel})` : ''}
              <input
                type="text"
                placeholder={activeProviderDef.defaultModel || 'nome-do-modelo'}
                value={(settings[`${activeProviderDef.id}_model`] as string | undefined) ?? ''}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  [`${activeProviderDef.id}_model`]: e.target.value,
                }))}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          )}

          <button onClick={saveSettings} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            {settingsSaved ? '✓ Salvo!' : 'Salvar'}
          </button>
          <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
            As chaves ficam salvas localmente no seu Chrome. Nunca são enviadas a nenhum servidor próprio.
          </p>
        </div>
      )}

      {/* Task input */}
      <div className="command-section" style={{ padding: 12, borderBottom: '1px solid #333' }}>

        {/* Active tab indicator */}
        <div style={{
          fontSize: 11, padding: '5px 8px', marginBottom: 8, borderRadius: 6,
          background: tabIsValid ? '#1a3a1a' : '#3a1a1a',
          color: tabIsValid ? '#30d158' : '#ff453a',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span aria-hidden="true">{tabIsValid ? '🟢' : '🔴'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTab
              ? tabIsValid ? activeTab.title || activeTab.url : 'Página interna (chrome://) — abra um site'
              : 'Detectando aba...'}
          </span>
        </div>

        {!tabIsValid && activeTab && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, padding: '4px 8px', background: '#1a1a1a', borderRadius: 4 }}>
            Clique em qualquer aba com um site (ex: google.com) e volte aqui.
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
          <label htmlFor="objective-input" style={{ fontSize: 11, color: '#888' }}>
            Descreva o que deseja fazer (Ctrl+Enter para iniciar)
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              id="objective-input"
              ref={objectiveRef}
              className="command-input"
              placeholder='Exemplo: "Pesquisar por IA no Google"'
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={running || !tabIsValid}
              rows={2}
              aria-label="Descreva o que deseja fazer"
              aria-describedby="objective-hint"
              style={{ flex: 1, resize: 'vertical', minHeight: 42 }}
              autoFocus
            />
            {running ? (
              <button
                onClick={stopTask}
                aria-label="Parar tarefa (Escape)"
                style={{ background: '#ff453a', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer', alignSelf: 'stretch' }}
              >
                Parar
              </button>
            ) : (
              <button
                className="btn-execute"
                onClick={startTask}
                disabled={!objective.trim() || !tabIsValid}
                aria-label="Iniciar tarefa (Ctrl+Enter)"
                title={!tabIsValid ? 'Abra um site primeiro' : 'Iniciar tarefa (Ctrl+Enter)'}
                style={{ alignSelf: 'stretch' }}
              >
                Iniciar
              </button>
            )}
          </div>
          <span id="objective-hint" className="sr-only">
            Use Ctrl+Enter para iniciar. Escape para parar. Alt+S para configurações.
          </span>
        </div>

        {/* Provider indicator */}
        <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
          Provider: <strong style={{ color: activeApiKey() ? '#30d158' : '#ff453a' }}>
            {settings.llm_provider ?? 'gemini'}
            {!activeApiKey() && ' — chave não configurada'}
          </strong>
        </div>

        {/* Agent state */}
        {agentState && agentState.status === 'running' && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#888' }} aria-live="polite">
            Passo {agentState.step} — {agentState.narration || agentState.lastAction}
            {agentState.lastReasoning && (
              <div style={{ marginTop: 2, color: '#666', fontStyle: 'italic' }}>
                {agentState.lastReasoning.substring(0, 120)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual scan */}
      <div className="actions-bar">
        <button
          className="btn-primary"
          onClick={scanPage}
          disabled={agentStatus === 'scanning' || !tabIsValid}
          title={!tabIsValid ? 'Abra um site primeiro' : ''}
        >
          {agentStatus === 'scanning' ? 'Escaneando...' : 'Escanear Página'}
        </button>
        {snapshot && (
          <span className={`source-badge source-${snapshot.source}`}>
            {snapshot.source === 'cdp' ? 'CDP' : 'DOM'}
          </span>
        )}
      </div>

      {/* Accessibility tree */}
      <div className="tree-panel">
        {!snapshot ? (
          <div className="tree-empty">
            Clique em "Escanear Página" para ver<br />a accessibility tree da aba ativa.
          </div>
        ) : (
          <TreeNode node={snapshot.tree} />
        )}
      </div>

      {/* Focusable elements */}
      {focusable.length > 0 && (
        <div className="focusable-panel">
          <h3>Elementos interativos ({focusable.length})</h3>
          {focusable.map((node, i) => (
            <div key={node.nodeId} className="focusable-item" title={node.nodeId}>
              <span className="fi-index">{i + 1}</span>
              <span className="fi-role">{node.role}</span>
              <span className="fi-name">{node.name || '(sem nome)'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="focusable-panel" style={{ borderTop: '1px solid #333', maxHeight: 130 }}>
          <h3>Log</h3>
          {log.map((entry, i) => (
            <div key={i} className="focusable-item" style={{ fontFamily: 'monospace', fontSize: 11, color: entry.error ? '#ff453a' : '#888' }}>
              [{entry.time}] {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
