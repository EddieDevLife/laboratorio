import { useState, useCallback } from 'react';
import { useDOMCapture, type DOMNode } from '../hooks/useDOMCapture';
import '../styles/DOMCapturePanel.css';

// ── Sub-componente: nó da árvore ──────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: DOMNode;
  depth: number;
  selected: string | null;
  onSelect: (uid: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.uid;

  const roleColor: Record<string, string> = {
    button: '#30d158',
    link: '#0a84ff',
    textbox: '#ff9f0a',
    searchbox: '#ff9f0a',
    combobox: '#ff9f0a',
    checkbox: '#bf5af2',
    radio: '#bf5af2',
    heading: '#ff6b6b',
    navigation: '#5e5ce6',
    main: '#5e5ce6',
    generic: '#555',
  };

  const color = roleColor[node.role] ?? '#888';

  return (
    <div className={`tree-row ${isSelected ? 'selected' : ''} ${!node.visible ? 'invisible' : ''}`}>
      <div
        className="tree-row-header"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => onSelect(node.uid)}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}

        <span className="tree-tag">&lt;{node.tag}&gt;</span>
        <span className="tree-role" style={{ color }}>
          {node.role !== 'generic' ? node.role : ''}
        </span>
        {node.name && <span className="tree-name">"{node.name.substring(0, 60)}"</span>}
        {node.interactive && (
          <span className="tree-badge interactive" title={`Interativo: ${node.interactiveReason}`}>
            ⚡
          </span>
        )}
        {node.focusable && <span className="tree-badge focusable" title="Focável">⌨</span>}
        {!node.visible && <span className="tree-badge hidden" title="Oculto">👁‍🗨</span>}
        {Object.keys(node.aria).length > 0 && (
          <span className="tree-badge aria" title={`${Object.keys(node.aria).length} atributos ARIA`}>
            A
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNodeRow
              key={child.uid}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: detalhes do nó ────────────────────────────────────────────

function NodeDetail({ node }: { node: DOMNode }) {
  return (
    <div className="node-detail">
      <h3>&lt;{node.tag}&gt; — {node.role}</h3>

      <table className="detail-table">
        <tbody>
          <tr><td>Nome acessível</td><td>{node.name || '—'}</td></tr>
          <tr><td>Descrição</td><td>{node.description || '—'}</td></tr>
          <tr><td>Valor</td><td>{node.value || '—'}</td></tr>
          <tr><td>ID</td><td>{node.id || '—'}</td></tr>
          <tr><td>Classes</td><td>{node.classes.join(', ') || '—'}</td></tr>
          <tr><td>Interativo</td><td>{node.interactive ? `✓ (${node.interactiveReason})` : '—'}</td></tr>
          <tr><td>Focável</td><td>{node.focusable ? `✓` : '—'}</td></tr>
          <tr><td>Visível</td><td>{node.visible ? '✓' : '✗'}</td></tr>
          <tr><td>tabIndex</td><td>{node.tabIndex ?? '—'}</td></tr>
          <tr><td>Posição</td>
            <td>{node.bounds.x}, {node.bounds.y} ({node.bounds.width}×{node.bounds.height})</td>
          </tr>
        </tbody>
      </table>

      {Object.keys(node.aria).length > 0 && (
        <>
          <h4>Atributos ARIA</h4>
          <table className="detail-table aria-table">
            <tbody>
              {Object.entries(node.aria).map(([k, v]) => (
                <tr key={k}>
                  <td>aria-{k}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type ActiveTab = 'tree' | 'interactive' | 'aria' | 'json';

export function DOMCapturePanel() {
  const {
    snapshot,
    capturing,
    capture,
    serializeToJSON,
    downloadJSON,
    copyJSON,
    getInteractiveElements,
    getFocusableElements,
    findByRole,
    findByName,
  } = useDOMCapture();

  const [activeTab, setActiveTab] = useState<ActiveTab>('tree');
  const [selectedUID, setSelectedUID] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [jsonPretty, setJsonPretty] = useState(true);

  const handleCapture = useCallback(() => {
    setSelectedUID(null);
    capture();
  }, [capture]);

  const handleCopy = useCallback(async () => {
    await copyJSON();
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [copyJSON]);

  // Encontrar nó selecionado
  const findNode = (tree: DOMNode | undefined, uid: string): DOMNode | null => {
    if (!tree) return null;
    if (tree.uid === uid) return tree;
    for (const child of tree.children) {
      const found = findNode(child, uid);
      if (found) return found;
    }
    return null;
  };
  const selectedNode = selectedUID ? findNode(snapshot?.tree, selectedUID) : null;

  // Resultados filtrados
  const searchResults = searchQuery.length >= 2 ? findByName(searchQuery) : [];
  const roleResults = roleFilter ? findByRole(roleFilter) : [];
  const interactiveElements = getInteractiveElements();
  const focusableElements = getFocusableElements();

  // Roles disponíveis para filtro
  const allRoles = (() => {
    if (!snapshot) return [];
    const roles = new Set<string>();
    function collect(node: DOMNode) {
      if (node.role !== 'generic') roles.add(node.role);
      node.children.forEach(collect);
    }
    collect(snapshot.tree);
    return Array.from(roles).sort();
  })();

  return (
    <div className="dom-capture-panel">
      {/* ── Header ── */}
      <div className="dcp-header">
        <h2>Captura DOM &amp; Accessibility Tree</h2>
        <div className="dcp-actions">
          <button
            className="btn-capture"
            onClick={handleCapture}
            disabled={capturing}
          >
            {capturing ? 'Capturando...' : '📋 Capturar'}
          </button>
          {snapshot && (
            <>
              <button className="btn-secondary" onClick={downloadJSON}>⬇ JSON</button>
              <button className="btn-secondary" onClick={handleCopy}>
                {copyDone ? '✓ Copiado!' : '📋 Copiar JSON'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {snapshot && (
        <div className="dcp-stats">
          <div className="stat-item">
            <span className="stat-label">Total de nós</span>
            <span className="stat-value">{snapshot.totalNodes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Interativos</span>
            <span className="stat-value interactive">{snapshot.interactiveCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Focáveis</span>
            <span className="stat-value focusable">{snapshot.focusableCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Capturado</span>
            <span className="stat-value">{new Date(snapshot.capturedAt).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      )}

      {!snapshot && !capturing && (
        <div className="dcp-empty">
          Clique em "Capturar" para analisar o DOM desta página.
        </div>
      )}

      {snapshot && (
        <div className="dcp-body">
          {/* ── Tabs ── */}
          <div className="dcp-tabs" role="tablist">
            {(['tree', 'interactive', 'aria', 'json'] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`dcp-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'tree' && '🌳 Árvore'}
                {tab === 'interactive' && `⚡ Interativos (${interactiveElements.length})`}
                {tab === 'aria' && '♿ ARIA'}
                {tab === 'json' && '{ } JSON'}
              </button>
            ))}
          </div>

          {/* ── Tab: Árvore DOM ── */}
          {activeTab === 'tree' && (
            <div className="dcp-tab-content">
              <div className="dcp-layout">
                <div className="dcp-tree-panel">
                  <input
                    type="search"
                    placeholder="Buscar por nome acessível..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="dcp-search"
                    aria-label="Buscar nós na árvore"
                  />
                  {searchQuery.length >= 2 ? (
                    <div className="search-results">
                      <p className="search-info">{searchResults.length} resultado(s) para "{searchQuery}"</p>
                      {searchResults.map(node => (
                        <div
                          key={node.uid}
                          className={`search-result-item ${selectedUID === node.uid ? 'selected' : ''}`}
                          onClick={() => { setSelectedUID(node.uid); setSearchQuery(''); }}
                        >
                          <span className="tree-tag">&lt;{node.tag}&gt;</span>
                          <span className="tree-role">{node.role}</span>
                          <span className="tree-name">"{node.name.substring(0, 50)}"</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="tree-scroll">
                      <TreeNodeRow
                        node={snapshot.tree}
                        depth={0}
                        selected={selectedUID}
                        onSelect={setSelectedUID}
                      />
                    </div>
                  )}
                </div>
                <div className="dcp-detail-panel">
                  {selectedNode
                    ? <NodeDetail node={selectedNode} />
                    : <p className="detail-hint">Clique em um nó para ver seus detalhes.</p>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Elementos Interativos ── */}
          {activeTab === 'interactive' && (
            <div className="dcp-tab-content">
              <p className="tab-info">
                {interactiveElements.length} elementos interativos · {focusableElements.length} focáveis
              </p>
              <div className="interactive-list">
                {interactiveElements.map((node, i) => (
                  <div
                    key={node.uid}
                    className={`interactive-item ${selectedUID === node.uid ? 'selected' : ''}`}
                    onClick={() => { setSelectedUID(node.uid); setActiveTab('tree'); }}
                  >
                    <span className="ii-index">{i + 1}</span>
                    <span className="ii-tag">&lt;{node.tag}&gt;</span>
                    <span className="ii-role">{node.role}</span>
                    <span className="ii-name">{node.name.substring(0, 60) || '(sem nome)'}</span>
                    <span className="ii-reason">{node.interactiveReason}</span>
                    {node.focusable && <span className="ii-badge">⌨</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: ARIA ── */}
          {activeTab === 'aria' && (
            <div className="dcp-tab-content">
              <div className="aria-filter">
                <label htmlFor="role-filter">Filtrar por role:</label>
                <select
                  id="role-filter"
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                >
                  <option value="">Todos os roles</option>
                  {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="aria-list">
                {(roleFilter ? roleResults : interactiveElements)
                  .filter(n => Object.keys(n.aria).length > 0 || n.name)
                  .map((node, i) => (
                    <div key={node.uid} className="aria-item">
                      <div className="aria-item-header">
                        <span className="ii-index">{i + 1}</span>
                        <strong>&lt;{node.tag}&gt;</strong>
                        <span className="ii-role">{node.role}</span>
                        <span className="ii-name">"{node.name.substring(0, 50)}"</span>
                      </div>
                      {Object.keys(node.aria).length > 0 && (
                        <div className="aria-attrs">
                          {Object.entries(node.aria).map(([k, v]) => (
                            <span key={k} className="aria-attr">
                              aria-{k}="{String(v)}"
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Tab: JSON ── */}
          {activeTab === 'json' && (
            <div className="dcp-tab-content">
              <div className="json-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={jsonPretty}
                    onChange={e => setJsonPretty(e.target.checked)}
                  />
                  Formatado
                </label>
                <button className="btn-secondary" onClick={downloadJSON}>⬇ Download</button>
                <button className="btn-secondary" onClick={handleCopy}>
                  {copyDone ? '✓ Copiado!' : '📋 Copiar'}
                </button>
              </div>
              <pre className="json-view">{serializeToJSON(jsonPretty)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
