import { useState, useRef, useCallback } from 'react';
import { useVision, type DetectedElement, type ElementKind, type VisionTask } from '../hooks/useVision';
import { useScreenshot } from '../hooks/useScreenshot';
import '../styles/VisionPanel.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<ElementKind, string> = {
  button:   '#0a84ff',
  input:    '#30d158',
  link:     '#bf5af2',
  image:    '#ff9f0a',
  text:     '#636366',
  select:   '#5ac8fa',
  checkbox: '#ff375f',
  other:    '#48484a',
};

const KIND_LABELS: Record<ElementKind, string> = {
  button:   'Botão',
  input:    'Campo',
  link:     'Link',
  image:    'Imagem',
  text:     'Texto',
  select:   'Select',
  checkbox: 'Checkbox',
  other:    'Outro',
};

// ── Overlay: bounding boxes desenhadas sobre a imagem ─────────────────────────

function BoundsOverlay({
  elements,
  imageWidth,
  imageHeight,
  filter,
  selected,
  onSelect,
}: {
  elements: DetectedElement[];
  imageWidth: number;
  imageHeight: number;
  filter: ElementKind | 'all';
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const visible = filter === 'all' ? elements : elements.filter(e => e.kind === filter);

  return (
    <svg
      className="bounds-overlay"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
    >
      {visible.map(el => {
        const { x, y, width, height } = el.bounds;
        const color = KIND_COLORS[el.kind];
        const isSelected = selected === el.id;
        return (
          <g key={el.id} onClick={() => onSelect(el.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={x} y={y} width={width} height={height}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={isSelected ? 3 : 1.5}
              rx={3}
            />
            <rect x={x} y={y - 16} width={Math.max(width, 60)} height={16} fill={color} rx={2} />
            <text x={x + 3} y={y - 4} fontSize={10} fill="#fff" style={{ fontFamily: 'monospace' }}>
              {KIND_LABELS[el.kind]} {Math.round(el.confidence * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'elements' | 'ocr' | 'colors' | 'patterns';

// ── Main panel ─────────────────────────────────────────────────────────────────

const DEFAULT_SESSION = 'local';
const ALL_TASKS: VisionTask[] = ['detect_elements', 'ocr', 'colors', 'patterns'];

export function VisionPanel({
  initialTab,
  onAnalyze,
}: {
  initialTab?: Tab;
  onAnalyze?: (summary: string, elementCount: number) => void;
} = {}) {
  const { analysis, analyzing, error, analyzeFromDataUrl, getElementsByKind, searchOCR, clear } = useVision();
  const { captureViewport, capturing } = useScreenshot();

  const [tab, setTab] = useState<Tab>(initialTab ?? 'elements');
  const [kindFilter, setKindFilter] = useState<ElementKind | 'all'>('all');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [ocrQuery, setOcrQuery] = useState('');
  const [tasks, setTasks] = useState<VisionTask[]>(ALL_TASKS);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEl = analysis?.elements.find(e => e.id === selectedElement) ?? null;

  // Captura viewport e analisa automaticamente
  const handleCapture = useCallback(async () => {
    const shot = await captureViewport();
    if (!shot) return;
    setScreenshotDataUrl(shot.dataUrl);
    const result = await analyzeFromDataUrl({
      dataUrl: shot.dataUrl,
      sessionId: DEFAULT_SESSION,
      tasks,
    });
    if (result) onAnalyze?.(result.summary, result.elements.length);
  }, [captureViewport, analyzeFromDataUrl, tasks, onAnalyze]);

  // Upload de arquivo
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      setScreenshotDataUrl(dataUrl);
      const result = await analyzeFromDataUrl({ dataUrl, sessionId: DEFAULT_SESSION, tasks });
      if (result) onAnalyze?.(result.summary, result.elements.length);
    };
    reader.readAsDataURL(file);
  }

  function toggleTask(task: VisionTask) {
    setTasks(prev =>
      prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task],
    );
  }

  const ocrResults = ocrQuery.length >= 2 ? searchOCR(ocrQuery) : analysis?.ocr ?? [];
  const elementsByKind = kindFilter === 'all' ? analysis?.elements ?? [] : getElementsByKind(kindFilter);

  const busy = capturing || analyzing;

  return (
    <section className="vision-panel" aria-label="Visão Computacional">
      {/* Header */}
      <div className="vp-header">
        <h2>👁 Visão Computacional</h2>
        <div className="vp-controls">
          {/* Task toggles */}
          <div className="vp-tasks">
            {(['detect_elements', 'ocr', 'colors', 'patterns'] as VisionTask[]).map(t => (
              <label key={t} className={`vp-task-toggle ${tasks.includes(t) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={tasks.includes(t)}
                  onChange={() => toggleTask(t)}
                  className="sr-only"
                />
                {t === 'detect_elements' ? '🔍 Elementos'
                  : t === 'ocr' ? '📝 OCR'
                  : t === 'colors' ? '🎨 Cores'
                  : '🧩 Padrões'}
              </label>
            ))}
          </div>
          <button className="btn-capture" onClick={handleCapture} disabled={busy}>
            {busy ? '⏳ Analisando…' : '📷 Capturar e Analisar'}
          </button>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            📂 Upload
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} />
          {analysis && (
            <button className="btn-danger-sm" onClick={clear} title="Limpar análise">✕</button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="vp-error" role="alert">{error}</p>}

      {/* Empty */}
      {!analysis && !busy && (
        <div className="vp-empty">
          <p>Capture um screenshot ou faça upload de uma imagem para analisar.</p>
          <p className="vp-hint">A IA detecta botões, campos, links, texto (OCR), cores dominantes e padrões de UI.</p>
        </div>
      )}

      {/* Loading */}
      {busy && (
        <div className="vp-loading">
          <div className="vp-spinner" />
          <p>{capturing ? 'Capturando screenshot…' : 'Analisando com Claude Vision…'}</p>
        </div>
      )}

      {/* Results */}
      {analysis && !busy && (
        <div className="vp-body">
          {/* Image with overlay */}
          <div className="vp-image-wrap">
            {screenshotDataUrl && (
              <>
                <img src={screenshotDataUrl} alt="Screenshot analisado" className="vp-image" />
                <BoundsOverlay
                  elements={analysis.elements}
                  imageWidth={analysis.imageWidth}
                  imageHeight={analysis.imageHeight}
                  filter={kindFilter}
                  selected={selectedElement}
                  onSelect={setSelectedElement}
                />
              </>
            )}
            {/* Summary bar */}
            <div className="vp-summary">{analysis.summary}</div>
          </div>

          {/* Right panel */}
          <div className="vp-right">
            {/* Stats */}
            <div className="vp-stats">
              <div className="vp-stat"><span className="vs-val">{analysis.elements.length}</span><span className="vs-lbl">Elementos</span></div>
              <div className="vp-stat"><span className="vs-val">{analysis.ocr.length}</span><span className="vs-lbl">Blocos OCR</span></div>
              <div className="vp-stat"><span className="vs-val">{analysis.dominantColors.length}</span><span className="vs-lbl">Cores</span></div>
              <div className="vp-stat"><span className="vs-val">{analysis.patterns.length}</span><span className="vs-lbl">Padrões</span></div>
            </div>

            {/* Tabs */}
            <div className="vp-tabs">
              {(['elements', 'ocr', 'colors', 'patterns'] as Tab[]).map(t => (
                <button
                  key={t}
                  className={`vp-tab ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'elements' ? '🔍 Elementos'
                    : t === 'ocr' ? '📝 OCR'
                    : t === 'colors' ? '🎨 Cores'
                    : '🧩 Padrões'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="vp-tab-content">

              {/* ── Elementos ── */}
              {tab === 'elements' && (
                <div>
                  <div className="vp-kind-filters">
                    {(['all', 'button', 'input', 'link', 'image', 'text', 'select', 'checkbox', 'other'] as const).map(k => (
                      <button
                        key={k}
                        className={`kind-chip ${kindFilter === k ? 'active' : ''}`}
                        style={k !== 'all' ? { '--chip-color': KIND_COLORS[k as ElementKind] } as React.CSSProperties : undefined}
                        onClick={() => setKindFilter(k)}
                      >
                        {k === 'all' ? 'Todos' : KIND_LABELS[k as ElementKind]}
                        {k === 'all'
                          ? ` (${analysis.elements.length})`
                          : ` (${getElementsByKind(k as ElementKind).length})`}
                      </button>
                    ))}
                  </div>

                  <div className="vp-element-list">
                    {elementsByKind.map(el => (
                      <div
                        key={el.id}
                        className={`vp-element-item ${selectedElement === el.id ? 'selected' : ''}`}
                        onClick={() => setSelectedElement(el.id === selectedElement ? null : el.id)}
                        style={{ '--el-color': KIND_COLORS[el.kind] } as React.CSSProperties}
                      >
                        <span className="el-kind" style={{ color: KIND_COLORS[el.kind] }}>{KIND_LABELS[el.kind]}</span>
                        <span className="el-label">{el.label || '—'}</span>
                        <span className="el-conf">{Math.round(el.confidence * 100)}%</span>
                        <span className="el-pos">{el.bounds.centerX}×{el.bounds.centerY}</span>
                      </div>
                    ))}
                    {elementsByKind.length === 0 && (
                      <p className="vp-empty-list">Nenhum elemento deste tipo detectado.</p>
                    )}
                  </div>

                  {/* Detail */}
                  {selectedEl && (
                    <div className="vp-element-detail">
                      <h4>Detalhe: {KIND_LABELS[selectedEl.kind]}</h4>
                      <table className="vp-detail-table">
                        <tbody>
                          <tr><td>Tipo</td><td style={{ color: KIND_COLORS[selectedEl.kind] }}>{selectedEl.kind}</td></tr>
                          <tr><td>Rótulo</td><td>{selectedEl.label}</td></tr>
                          <tr><td>Confiança</td><td>{Math.round(selectedEl.confidence * 100)}%</td></tr>
                          <tr><td>Posição</td><td>x:{selectedEl.bounds.x} y:{selectedEl.bounds.y}</td></tr>
                          <tr><td>Tamanho</td><td>{selectedEl.bounds.width}×{selectedEl.bounds.height}px</td></tr>
                          <tr><td>Centro</td><td>{selectedEl.bounds.centerX}×{selectedEl.bounds.centerY}</td></tr>
                          {selectedEl.attributes && Object.entries(selectedEl.attributes).map(([k, v]) => (
                            <tr key={k}><td>{k}</td><td>{v}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── OCR ── */}
              {tab === 'ocr' && (
                <div>
                  <input
                    type="search"
                    className="vp-search"
                    placeholder="Buscar texto (mín. 2 chars)…"
                    value={ocrQuery}
                    onChange={e => setOcrQuery(e.target.value)}
                  />
                  <p className="vp-count">{ocrResults.length} bloco{ocrResults.length !== 1 ? 's' : ''}</p>
                  <div className="ocr-list">
                    {ocrResults.map((block, i) => (
                      <div key={i} className="ocr-block">
                        <span className="ocr-text">{block.text}</span>
                        <span className="ocr-conf">{Math.round(block.confidence * 100)}%</span>
                        <span className="ocr-pos">{block.bounds.x},{block.bounds.y}</span>
                        {block.language && <span className="ocr-lang">{block.language}</span>}
                      </div>
                    ))}
                    {ocrResults.length === 0 && <p className="vp-empty-list">Nenhum texto encontrado.</p>}
                  </div>
                </div>
              )}

              {/* ── Colors ── */}
              {tab === 'colors' && (
                <div className="color-list">
                  {analysis.dominantColors.map((c, i) => (
                    <div key={i} className="color-item">
                      <div className="color-swatch" style={{ background: c.hex }} />
                      <div className="color-info">
                        <span className="color-name">{c.name}</span>
                        <span className="color-hex">{c.hex}</span>
                        <span className="color-rgb">rgb({c.rgb.join(', ')})</span>
                      </div>
                      <div className="color-bar-wrap">
                        <div className="color-bar" style={{ width: `${Math.round(c.coverage * 100)}%`, background: c.hex }} />
                        <span className="color-pct">{Math.round(c.coverage * 100)}%</span>
                      </div>
                    </div>
                  ))}
                  {analysis.dominantColors.length === 0 && <p className="vp-empty-list">Nenhuma cor analisada.</p>}
                </div>
              )}

              {/* ── Patterns ── */}
              {tab === 'patterns' && (
                <div>
                  {analysis.patterns.length > 0 ? (
                    <div className="pattern-list">
                      {analysis.patterns.map((p, i) => (
                        <span key={i} className="pattern-chip">{p}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="vp-empty-list">Nenhum padrão de UI detectado.</p>
                  )}
                  <div className="vp-meta">
                    <p className="vp-meta-label">Dimensões da imagem</p>
                    <p>{analysis.imageWidth} × {analysis.imageHeight}px</p>
                    <p className="vp-meta-label">Analisado em</p>
                    <p>{new Date(analysis.analyzedAt).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </section>
  );
}
