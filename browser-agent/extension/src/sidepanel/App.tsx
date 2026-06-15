import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PageSnapshot,
  AccessibilityNode,
  AgentStatus,
  InternalMessage,
} from '../shared/types.js';
import { collectFocusable } from '../shared/types.js';
import AgentStatusBadge from './components/AgentStatus.js';
import TreeNode from './components/TreeNode.js';
import type { Provider, StoredSettings } from '../background/llm-client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoopState {
  status: 'idle' | 'running' | 'done' | 'error';
  step: number;
  lastAction?: string;
  lastReasoning?: string;
  error?: string;
}

interface LogEntry { time: string; text: string; error: boolean }

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [loopState, setLoopState] = useState<LoopState | null>(null);
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
  const [focusable, setFocusable] = useState<AccessibilityNode[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [objective, setObjective] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Settings
  const [settings, setSettings] = useState<StoredSettings>({
    llm_provider: 'gemini',
    anthropic_api_key: '',
    openai_api_key: '',
    gemini_api_key: '',
    openai_model: 'gpt-4o',
    gemini_model: 'gemini-2.0-flash',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [activeTab, setActiveTab] = useState<{ url: string; title: string; id: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = agentStatus === 'running' || agentStatus === 'scanning';
  const tabIsValid = !!activeTab && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://');

  // ── Monitor active tab ────────────────────────────────────────────────────

  useEffect(() => {
    async function refreshTab() {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id && tab.url && tab.title) {
        setActiveTab({ url: tab.url, title: tab.title, id: tab.id });
      }
    }
    refreshTab();
    // Atualiza quando o usuário muda de aba
    chrome.tabs.onActivated.addListener(refreshTab);
    chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === 'complete') refreshTab(); });
    return () => {
      chrome.tabs.onActivated.removeListener(refreshTab);
    };
  }, []);

  // ── Load settings on mount ─────────────────────────────────────────────────

  useEffect(() => {
    chrome.storage.local.get([
      'llm_provider', 'anthropic_api_key', 'openai_api_key',
      'gemini_api_key', 'openai_model', 'gemini_model',
    ], (result) => {
      setSettings((prev) => ({ ...prev, ...result } as StoredSettings));
    });
  }, []);

  // ── Messages from service worker ───────────────────────────────────────────

  useEffect(() => {
    function onMessage(msg: InternalMessage) {
      if (msg.type === 'TREE_CAPTURED') {
        const snap = msg.payload;
        const fc = collectFocusable(snap.tree);
        setSnapshot(snap);
        setFocusable(fc);
        setAgentStatus('idle');
        addLog(`Árvore capturada via ${snap.source.toUpperCase()} — ${fc.length} elementos`);
      }

      if (msg.type === 'CAPTURE_ERROR') {
        setAgentStatus('error');
        addLog(msg.payload.error, true);
      }

      if (msg.type === 'STATUS_UPDATE') {
        if (msg.payload.status === 'running') setAgentStatus('running');
        else if (msg.payload.status === 'error') setAgentStatus('error');
        else setAgentStatus('idle');
        if (msg.payload.message) addLog(msg.payload.message);
      }

      if ((msg as { type: string }).type === 'AGENT_STATE') {
        const state = (msg as { type: string; payload: LoopState }).payload;
        setLoopState(state);
        if (state.status === 'running') setAgentStatus('running');
        else if (state.status === 'error') { setAgentStatus('error'); if (state.error) addLog(state.error, true); }
        else setAgentStatus('idle');
      }

      if (msg.type === 'ACTION_RESULT') {
        const r = msg.payload;
        addLog(r.success ? 'Ação executada' : `Falha: ${r.error}`, !r.success);
      }
    }

    chrome.runtime.onMessage.addListener(
      onMessage as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
    );
    return () => chrome.runtime.onMessage.removeListener(
      onMessage as Parameters<typeof chrome.runtime.onMessage.addListener>[0]
    );
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function addLog(text: string, error = false) {
    const time = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setLog((prev) => [{ time, text, error }, ...prev].slice(0, 80));
  }

  // ── Actions ────────────────────────────────────────────────────────────────

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
    setLoopState({ status: 'running', step: 0, lastAction: 'Iniciando...' });
    addLog(`Iniciando tarefa: "${objective.trim()}"`);

    chrome.runtime.sendMessage({
      type: 'START_TASK',
      payload: { tabId: tab.id, objective: objective.trim() },
    } as unknown as InternalMessage);

    setObjective('');
  }, [objective, settings]);

  const stopTask = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'STOP_TASK' } as unknown as InternalMessage);
    setAgentStatus('idle');
    setLoopState(null);
    addLog('Tarefa interrompida pelo usuário');
  }, []);

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
    if (settings.llm_provider === 'anthropic') return settings.anthropic_api_key ?? '';
    if (settings.llm_provider === 'openai') return settings.openai_api_key ?? '';
    if (settings.llm_provider === 'gemini') return settings.gemini_api_key ?? '';
    return '';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* Header */}
      <div className="header">
        <h1>Browser Agent</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AgentStatusBadge status={agentStatus} />
          <button
            onClick={() => setShowSettings((s) => !s)}
            title="Configurações"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: showSettings ? 'var(--blue)' : 'var(--text2)' }}
          >⚙️</button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel" style={{
          padding: 12,
          borderBottom: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <h3 style={{ margin: 0, fontSize: 13 }}>Configurações de LLM</h3>

          <label style={{ fontSize: 12 }}>
            Provider
            <select
              value={settings.llm_provider ?? 'gemini'}
              onChange={(e) => setSettings((s) => ({ ...s, llm_provider: e.target.value as Provider }))}
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>

          {settings.llm_provider === 'anthropic' && (
            <label style={{ fontSize: 12 }}>
              Anthropic API Key
              <input
                type="password"
                placeholder="sk-ant-..."
                value={settings.anthropic_api_key ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, anthropic_api_key: e.target.value }))}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          )}

          {settings.llm_provider === 'openai' && (
            <>
              <label style={{ fontSize: 12 }}>
                OpenAI API Key
                <input
                  type="password"
                  placeholder="sk-..."
                  value={settings.openai_api_key ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, openai_api_key: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Modelo (opcional)
                <input
                  type="text"
                  placeholder="gpt-4o"
                  value={settings.openai_model ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, openai_model: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
            </>
          )}

          {settings.llm_provider === 'gemini' && (
            <>
              <label style={{ fontSize: 12 }}>
                Gemini API Key
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.gemini_api_key ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, gemini_api_key: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Modelo (opcional)
                <input
                  type="text"
                  placeholder="gemini-2.0-flash"
                  value={settings.gemini_model ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, gemini_model: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
            </>
          )}

          <button
            onClick={saveSettings}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {settingsSaved ? '✓ Salvo!' : 'Salvar'}
          </button>

          <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
            As chaves ficam salvas localmente no seu Chrome. Nunca são enviadas a nenhum servidor próprio.
          </p>
        </div>
      )}

      {/* Task input */}
      <div className="command-section" style={{ padding: 12, borderBottom: '1px solid #333' }}>

        {/* Aba ativa */}
        <div style={{
          fontSize: 11,
          padding: '5px 8px',
          marginBottom: 8,
          borderRadius: 6,
          background: tabIsValid ? '#1a3a1a' : '#3a1a1a',
          color: tabIsValid ? '#30d158' : '#ff453a',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{tabIsValid ? '🟢' : '🔴'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTab
              ? tabIsValid
                ? activeTab.title || activeTab.url
                : 'Página interna (chrome://) — abra um site'
              : 'Detectando aba...'}
          </span>
        </div>

        {!tabIsValid && activeTab && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, padding: '4px 8px', background: '#1a1a1a', borderRadius: 4 }}>
            Clique em qualquer aba com um site (ex: google.com) e volte aqui.
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder='Objetivo: "Pesquisar por IA no Google"'
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !running && tabIsValid) startTask(); }}
            disabled={running || !tabIsValid}
            style={{ flex: 1 }}
          />
          {running ? (
            <button onClick={stopTask} style={{ background: '#ff453a', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer' }}>
              Parar
            </button>
          ) : (
            <button
              className="btn-execute"
              onClick={startTask}
              disabled={!objective.trim() || !tabIsValid}
              title={!tabIsValid ? 'Abra um site primeiro' : ''}
            >
              Iniciar
            </button>
          )}
        </div>

        {/* Provider indicator */}
        <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
          Provider: <strong style={{ color: activeApiKey() ? '#30d158' : '#ff453a' }}>
            {settings.llm_provider ?? 'gemini'}
            {!activeApiKey() && ' — chave não configurada'}
          </strong>
        </div>

        {/* Agent state */}
        {loopState && loopState.status === 'running' && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
            Passo {loopState.step} — {loopState.lastAction}
            {loopState.lastReasoning && (
              <div style={{ marginTop: 2, color: '#666', fontStyle: 'italic' }}>
                {loopState.lastReasoning.substring(0, 120)}
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
            <div
              key={i}
              className="focusable-item"
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: entry.error ? '#ff453a' : '#888',
              }}
            >
              [{entry.time}] {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
