import { useState, useCallback } from 'react';
import { useKeyboardNav, type FocusedElement, type KeyEvent } from '../hooks/useKeyboardNav';
import '../styles/DOMAccessibilityPanel.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

function StateBadge({ label, active, color = '#0a84ff' }: { label: string; active: boolean; color?: string }) {
  if (!active) return null;
  return <span className="state-badge" style={{ borderColor: color, color }}>{label}</span>;
}

function ElementCard({ el, selected, onClick }: { el: FocusedElement; selected: boolean; onClick: () => void }) {
  const { state } = el;
  return (
    <div
      className={`el-card ${selected ? 'selected' : ''} ${state.hidden ? 'hidden' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Elemento ${el.order}: ${el.role} ${el.name}`}
    >
      <div className="el-card-top">
        <span className="ec-order">#{el.order}</span>
        <span className="ec-tag">&lt;{el.tag}&gt;</span>
        <span className="ec-role">{el.role}</span>
        {el.tabIndex > 0 && <span className="ec-tabindex">tabindex={el.tabIndex}</span>}
        <div className="ec-states">
          <StateBadge label="desabilitado" active={state.disabled} color="#ff453a" />
          <StateBadge label="readonly"     active={state.readonly}  color="#ff9f0a" />
          <StateBadge label="obrigatório"  active={state.required}  color="#bf5af2" />
          <StateBadge label="inválido"     active={state.invalid}   color="#ff453a" />
          <StateBadge label="expandido"    active={state.expanded === true} color="#30d158" />
          <StateBadge label="marcado"      active={state.checked === true}  color="#30d158" />
          <StateBadge label="selecionado"  active={state.selected === true} color="#0a84ff" />
          <StateBadge label="oculto"       active={state.hidden}    color="#555" />
        </div>
      </div>
      {el.name && <div className="ec-name">"{el.name}"</div>}
      {el.path && <div className="ec-path">{el.path}</div>}
    </div>
  );
}

function KeyEventRow({ ev }: { ev: KeyEvent }) {
  const KEY_COLORS: Record<string, string> = {
    Tab: '#0a84ff', Enter: '#30d158', Escape: '#ff453a',
    ArrowUp: '#ff9f0a', ArrowDown: '#ff9f0a', ArrowLeft: '#ff9f0a', ArrowRight: '#ff9f0a',
    Space: '#bf5af2',
  };
  const color = KEY_COLORS[ev.key] ?? '#888';
  const time = new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="key-event-row">
      <span className="ke-key" style={{ color, borderColor: `${color}60` }}>{ev.key}</span>
      <span className="ke-effect">{ev.effect}</span>
      <span className="ke-time">{time}</span>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

type PanelTab = 'tab-order' | 'keyboard' | 'structure';

export function DOMAccessibilityPanel() {
  const {
    currentFocus,
    tabOrder,
    keyHistory,
    navigating,
    pressTab,
    pressEnter,
    pressEscape,
    pressArrow,
    pressSpace,
    buildTabOrder,
    clearHistory,
  } = useKeyboardNav();

  const [activeTab, setActiveTab] = useState<PanelTab>('tab-order');
  const [selectedEl, setSelectedEl] = useState<FocusedElement | null>(null);
  const [built, setBuilt] = useState(false);

  const handleBuild = useCallback(() => {
    buildTabOrder();
    setBuilt(true);
  }, [buildTabOrder]);

  return (
    <section className="dom-a11y-panel" aria-label="Modo DOM / Acessibilidade">

      {/* Header */}
      <div className="dap-header">
        <h2>♿ DOM / Acessibilidade</h2>
        <div className="dap-actions">
          <button className="btn-primary" onClick={handleBuild} disabled={navigating}>
            {navigating ? '⏳ Analisando…' : '🔍 Analisar estrutura'}
          </button>
        </div>
      </div>

      {/* Current focus indicator */}
      {currentFocus && (
        <div className="focus-indicator" role="status" aria-live="polite">
          <span className="fi-label">Foco atual:</span>
          <span className="fi-role">{currentFocus.role}</span>
          <span className="fi-name">"{currentFocus.name || currentFocus.tag}"</span>
          <span className="fi-order">ordem #{currentFocus.order}</span>
        </div>
      )}

      {/* Keyboard simulator */}
      <div className="keyboard-sim" aria-label="Simulador de teclado">
        <div className="ks-label">Simular teclas:</div>
        <div className="ks-keys">
          <button className="key-btn tab"    onClick={() => pressTab(false)} title="Tab">⇥ Tab</button>
          <button className="key-btn tab"    onClick={() => pressTab(true)}  title="Shift+Tab">⇤ Shift+Tab</button>
          <button className="key-btn enter"  onClick={pressEnter}            title="Enter">↵ Enter</button>
          <button className="key-btn escape" onClick={pressEscape}           title="Escape">✕ Esc</button>
          <button className="key-btn space"  onClick={pressSpace}            title="Space">␣ Space</button>
          <div className="ks-arrows">
            <button className="key-btn arrow" onClick={() => pressArrow('up')}>▲</button>
            <div className="ks-arrows-row">
              <button className="key-btn arrow" onClick={() => pressArrow('left')}>◀</button>
              <button className="key-btn arrow" onClick={() => pressArrow('down')}>▼</button>
              <button className="key-btn arrow" onClick={() => pressArrow('right')}>▶</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dap-tabs">
        {(['tab-order', 'keyboard', 'structure'] as PanelTab[]).map(t => (
          <button
            key={t}
            className={`dap-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'tab-order' ? `⌨ Ordem de Tab (${tabOrder.length})`
              : t === 'keyboard' ? `📋 Eventos (${keyHistory.length})`
              : '🏗 Estrutura'}
          </button>
        ))}
      </div>

      <div className="dap-content">

        {/* ── Tab order ── */}
        {activeTab === 'tab-order' && (
          <div>
            {!built ? (
              <p className="dap-empty">Clique em "Analisar estrutura" para mapear a ordem de Tab da página.</p>
            ) : tabOrder.length === 0 ? (
              <p className="dap-empty">Nenhum elemento focável encontrado.</p>
            ) : (
              <div className="tab-order-layout">
                <div className="tab-order-list">
                  <p className="dap-count">{tabOrder.length} elementos na ordem de foco</p>
                  {tabOrder.map(el => (
                    <ElementCard
                      key={el.uid + el.order}
                      el={el}
                      selected={selectedEl?.uid === el.uid && selectedEl?.order === el.order}
                      onClick={() => setSelectedEl(prev =>
                        prev?.uid === el.uid && prev?.order === el.order ? null : el
                      )}
                    />
                  ))}
                </div>
                {selectedEl && (
                  <div className="el-detail-panel">
                    <h4>Detalhe: #{selectedEl.order} &lt;{selectedEl.tag}&gt;</h4>
                    <table className="el-detail-table">
                      <tbody>
                        <tr><td>Tag</td><td>&lt;{selectedEl.tag}&gt;</td></tr>
                        <tr><td>Role</td><td>{selectedEl.role}</td></tr>
                        <tr><td>Nome</td><td>{selectedEl.name || '—'}</td></tr>
                        <tr><td>tabIndex</td><td>{selectedEl.tabIndex}</td></tr>
                        <tr><td>Ordem</td><td>#{selectedEl.order}</td></tr>
                        <tr><td>Path</td><td className="mono">{selectedEl.path}</td></tr>
                        {selectedEl.bounds && <>
                          <tr><td>Posição</td><td>{selectedEl.bounds.x}, {selectedEl.bounds.y}</td></tr>
                          <tr><td>Tamanho</td><td>{selectedEl.bounds.width}×{selectedEl.bounds.height}px</td></tr>
                        </>}
                        <tr><td colSpan={2} className="detail-section">Estados</td></tr>
                        {Object.entries(selectedEl.state).map(([k, v]) =>
                          v !== undefined && v !== false && v !== '' ? (
                            <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>
                          ) : null
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Key events ── */}
        {activeTab === 'keyboard' && (
          <div>
            <div className="dap-topbar">
              <p className="dap-count">{keyHistory.length} eventos registrados</p>
              {keyHistory.length > 0 && (
                <button className="btn-clear" onClick={clearHistory}>Limpar</button>
              )}
            </div>
            {keyHistory.length === 0 ? (
              <p className="dap-empty">Use o simulador acima para registrar eventos de teclado.</p>
            ) : (
              <div className="key-event-list">
                {keyHistory.map(ev => <KeyEventRow key={ev.id} ev={ev} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Structure ── */}
        {activeTab === 'structure' && (
          <div>
            {!built ? (
              <p className="dap-empty">Clique em "Analisar estrutura" primeiro.</p>
            ) : (
              <div className="structure-view">
                {/* Rótulos e descrições */}
                <div className="struct-section">
                  <h4>Rótulos e Descrições</h4>
                  <div className="label-list">
                    {tabOrder.filter(el => el.name).map(el => (
                      <div key={el.uid + el.order} className="label-item">
                        <span className="li-role">{el.role}</span>
                        <span className="li-name">"{el.name}"</span>
                        {el.state.required && <span className="li-badge required">obrigatório</span>}
                        {el.state.disabled && <span className="li-badge disabled">desabilitado</span>}
                      </div>
                    ))}
                    {tabOrder.filter(el => el.name).length === 0 && (
                      <p className="dap-empty">Nenhum elemento com rótulo encontrado.</p>
                    )}
                  </div>
                </div>

                {/* Estados */}
                <div className="struct-section">
                  <h4>Estados dos Elementos</h4>
                  <div className="state-summary">
                    {[
                      { label: 'Focáveis', count: tabOrder.length, color: '#0a84ff' },
                      { label: 'Desabilitados', count: tabOrder.filter(e => e.state.disabled).length, color: '#ff453a' },
                      { label: 'Obrigatórios', count: tabOrder.filter(e => e.state.required).length, color: '#bf5af2' },
                      { label: 'Inválidos', count: tabOrder.filter(e => e.state.invalid).length, color: '#ff453a' },
                      { label: 'Readonly', count: tabOrder.filter(e => e.state.readonly).length, color: '#ff9f0a' },
                      { label: 'Marcados', count: tabOrder.filter(e => e.state.checked === true).length, color: '#30d158' },
                      { label: 'Expandidos', count: tabOrder.filter(e => e.state.expanded === true).length, color: '#30d158' },
                      { label: 'Ocultos', count: tabOrder.filter(e => e.state.hidden).length, color: '#555' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="state-stat">
                        <span className="ss-count" style={{ color }}>{count}</span>
                        <span className="ss-label">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Elementos sem rótulo — problema de acessibilidade */}
                {(() => {
                  const unlabeled = tabOrder.filter(el =>
                    !el.name && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(el.role)
                  );
                  if (unlabeled.length === 0) return null;
                  return (
                    <div className="struct-section">
                      <h4 className="warn-title">⚠ Problemas de Acessibilidade ({unlabeled.length})</h4>
                      <div className="label-list">
                        {unlabeled.map(el => (
                          <div key={el.uid + el.order} className="label-item warn">
                            <span className="li-role">{el.role}</span>
                            <span className="li-name warn-text">&lt;{el.tag}&gt; sem rótulo</span>
                            <span className="li-path">{el.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
