import { useState } from 'react';
import './App.css';
import { DOMCapturePanel } from './components/DOMCapturePanel';
import { DOMAccessibilityPanel } from './components/DOMAccessibilityPanel';
import { ScreenshotsPanel } from './components/ScreenshotsPanel';
import { VisionPanel } from './components/VisionPanel';
import { useActionHistory } from './hooks/useActionHistory';
import type { ActionType } from './hooks/useActionHistory';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Mode = 'dom' | 'vision';
type View = 'dom-capture' | 'accessibility' | 'screenshots' | 'vision-detect' | 'vision-ocr';

interface NavItem {
  id: View;
  icon: string;
  label: string;
  mode: Mode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dom-capture',    icon: '🌳', label: 'Captura de DOM',       mode: 'dom' },
  { id: 'accessibility',  icon: '♿', label: 'Accessibility Tree',    mode: 'dom' },
  { id: 'screenshots',    icon: '📸', label: 'Screenshots',           mode: 'dom' },
  { id: 'vision-detect',  icon: '🔍', label: 'Detecção de Elementos', mode: 'vision' },
  { id: 'vision-ocr',     icon: '📝', label: 'OCR & Cores',           mode: 'vision' },
];

const PAGE_LABELS: Record<View, { title: string; subtitle: string }> = {
  'dom-capture':   { title: 'Captura de DOM',          subtitle: 'Inspecione a estrutura e os atributos de acessibilidade da página' },
  'accessibility': { title: 'DOM / Acessibilidade',    subtitle: 'Ordem de Tab, simulação de teclado, rótulos e estados dos elementos' },
  'screenshots':   { title: 'Screenshots',             subtitle: 'Capture o viewport ou a página inteira e gerencie o histórico' },
  'vision-detect': { title: 'Detecção de Elementos',   subtitle: 'Claude Vision identifica botões, campos, links e imagens na tela' },
  'vision-ocr':    { title: 'OCR, Cores e Padrões',    subtitle: 'Extração de texto, paleta de cores dominantes e padrões de UI' },
};

// ── History item ───────────────────────────────────────────────────────────────

function HistoryItem({ item }: { item: ReturnType<typeof useActionHistory>['actions'][0] }) {
  const TYPE_ICONS: Record<ActionType, string> = {
    dom: '🌳', vision: '👁', mouse: '🖱', llm: '🤖',
    screenshot: '📸', capture: '📋', command: '⌨',
  };

  return (
    <div className={`history-item ${item.type}`}>
      <div className="hi-top">
        <span className="hi-type">{TYPE_ICONS[item.type]} {item.type}</span>
        <span className="hi-time">
          {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div className="hi-text">{item.label}</div>
      {item.detail && <div className="hi-text" style={{ color: '#555' }}>{item.detail}</div>}
      {item.durationMs !== undefined && (
        <div className="hi-duration">{item.durationMs}ms</div>
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function App() {
  const [activeView, setActiveView] = useState<View>('dom-capture');
  const [activeMode, setActiveMode] = useState<Mode>('dom');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const { actions, push, clear } = useActionHistory();

  // Verificar backend ao mudar de aba
  function handleViewChange(view: View, mode: Mode) {
    setActiveView(view);
    setActiveMode(mode);

    // Ping backend
    fetch('http://localhost:3001/health')
      .then(r => setBackendOnline(r.ok))
      .catch(() => setBackendOnline(false));
  }

  const page = PAGE_LABELS[activeView];
  const domItems = NAV_ITEMS.filter(n => n.mode === 'dom');
  const visionItems = NAV_ITEMS.filter(n => n.mode === 'vision');

  return (
    <div className="dashboard">

      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="topbar-logo">Mouse<span>Agent</span></div>
        <div className="topbar-sep" />
        <span
          className={`topbar-badge ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : ''}`}
        >
          {backendOnline === true ? '● Backend online'
            : backendOnline === false ? '● Backend offline'
            : '○ Backend'}
        </span>
        <span className="topbar-session">session: local</span>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar" aria-label="Navegação principal">

        {/* Mode switcher */}
        <div className="sidebar-section">
          <div className="sidebar-label">Modo</div>
          <div className="mode-switcher">
            <button
              className={`mode-btn ${activeMode === 'dom' ? 'active' : ''}`}
              onClick={() => handleViewChange('dom-capture', 'dom')}
            >
              <span className="mode-icon">🌳</span>
              <span className="mode-info">
                <span className="mode-name">DOM / Acessibilidade</span>
                <span className="mode-desc">Navega pela estrutura semântica</span>
              </span>
            </button>
            <button
              className={`mode-btn ${activeMode === 'vision' ? 'active' : ''}`}
              onClick={() => handleViewChange('vision-detect', 'vision')}
            >
              <span className="mode-icon">👁</span>
              <span className="mode-info">
                <span className="mode-name">Visão Computacional</span>
                <span className="mode-desc">Analisa pixels com Claude Vision</span>
              </span>
            </button>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* DOM views */}
        <div className="sidebar-section">
          <div className="sidebar-label">DOM</div>
          <div className="sidebar-nav">
            {domItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => handleViewChange(item.id, item.mode)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Vision views */}
        <div className="sidebar-section">
          <div className="sidebar-label">Visão</div>
          <div className="sidebar-nav">
            {visionItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => handleViewChange(item.id, item.mode)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Stats */}
        <div className="sidebar-section">
          <div className="sidebar-label">Sessão</div>
          <div style={{ padding: '4px 8px', fontSize: '11px', color: '#555' }}>
            <div style={{ marginBottom: 4 }}>{actions.length} ação{actions.length !== 1 ? 'ões' : ''} registrada{actions.length !== 1 ? 's' : ''}</div>
            <div>Backend: {backendOnline === true ? '✓ online' : backendOnline === false ? '✗ offline' : '— '}</div>
          </div>
        </div>

      </nav>

      {/* ── Main content ── */}
      <main className="main-content" aria-label={page.title}>
        <div className="page-header">
          <h1 className="page-title">{page.title}</h1>
          <p className="page-subtitle">{page.subtitle}</p>
        </div>

        {/* DOM Capture */}
        {activeView === 'dom-capture' && (
          <div className="dom-viewer-wrap">
            <DOMCapturePanel
              initialTab="tree"
              onCapture={() => push({ type: 'capture', label: 'DOM capturado', detail: window.location.href })}
            />
          </div>
        )}

        {/* Accessibility / Keyboard nav */}
        {activeView === 'accessibility' && (
          <DOMAccessibilityPanel />
        )}

        {/* Screenshots */}
        {activeView === 'screenshots' && (
          <ScreenshotsPanel
            onCapture={(mode, size) =>
              push({ type: 'screenshot', label: `Screenshot ${mode}`, detail: `${size} KB` })
            }
          />
        )}

        {/* Vision */}
        {(activeView === 'vision-detect' || activeView === 'vision-ocr') && (
          <VisionPanel
            initialTab={activeView === 'vision-ocr' ? 'ocr' : 'elements'}
            onAnalyze={(summary, count) =>
              push({ type: 'vision', label: summary, detail: `${count} elementos detectados` })
            }
          />
        )}
      </main>

      {/* ── History panel ── */}
      <aside className="history-panel" aria-label="Histórico de ações">
        <div className="history-header">
          <h3>Histórico</h3>
          {actions.length > 0 && (
            <button className="history-clear" onClick={clear}>Limpar</button>
          )}
        </div>
        <div className="history-list">
          {actions.length === 0 ? (
            <p className="history-empty">Nenhuma ação ainda.<br />Capture DOM ou screenshots para começar.</p>
          ) : (
            actions.map(a => <HistoryItem key={a.id} item={a} />)
          )}
        </div>
      </aside>

    </div>
  );
}
