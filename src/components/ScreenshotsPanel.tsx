import { useState, useRef } from 'react';
import { useScreenshot, type Screenshot, type ScreenshotFormat } from '../hooks/useScreenshot';
import '../styles/ScreenshotsPanel.css';

// ── Formatação ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ── Thumbnail ──────────────────────────────────────────────────────────────────

function Thumbnail({
  shot,
  selected,
  onClick,
  onDelete,
}: {
  shot: Screenshot;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`ss-thumb ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Screenshot ${shot.mode} de ${formatDate(shot.capturedAt)}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <img src={shot.dataUrl} alt={`Screenshot ${shot.id}`} className="ss-thumb-img" loading="lazy" />
      <div className="ss-thumb-overlay">
        <span className={`ss-mode-badge ${shot.mode}`}>{shot.mode}</span>
        <button
          className="ss-delete-btn"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label="Remover screenshot"
          title="Remover"
        >✕</button>
      </div>
      <div className="ss-thumb-info">
        <span className="ss-thumb-size">{formatSize(shot.fileSizeKB)}</span>
        <span className="ss-thumb-dim">{shot.width}×{shot.height}</span>
      </div>
    </div>
  );
}

// ── Detail ─────────────────────────────────────────────────────────────────────

function ScreenshotDetail({
  shot,
  onDownload,
  onCopy,
}: {
  shot: Screenshot;
  onDownload: () => void;
  onCopy: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="ss-detail">
      <img src={shot.dataUrl} alt="Screenshot completo" className="ss-detail-img" />
      <div className="ss-detail-meta">
        <table className="ss-meta-table">
          <tbody>
            <tr><td>Modo</td><td><span className={`ss-mode-badge ${shot.mode}`}>{shot.mode}</span></td></tr>
            <tr><td>Formato</td><td>{shot.format.toUpperCase()}</td></tr>
            <tr><td>Dimensões</td><td>{shot.width} × {shot.height}px</td></tr>
            <tr><td>Tamanho</td><td>{formatSize(shot.fileSizeKB)}</td></tr>
            <tr><td>Capturado</td><td>{formatDate(shot.capturedAt)}</td></tr>
            <tr><td>Página</td><td className="ss-url">{shot.title || '—'}</td></tr>
            {shot.label && <tr><td>Rótulo</td><td>{shot.label}</td></tr>}
          </tbody>
        </table>
        <div className="ss-detail-actions">
          <button className="btn-primary" onClick={onDownload}>↓ Baixar</button>
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? '✓ Copiado!' : '⧉ Copiar imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Painel principal ───────────────────────────────────────────────────────────

export function ScreenshotsPanel({ onCapture }: { onCapture?: (mode: string, sizeKB: number) => void } = {}) {
  const {
    screenshots,
    capturing,
    error,
    captureViewport,
    captureFullPage,
    remove,
    clear,
    download,
    downloadAll,
    copyToClipboard,
  } = useScreenshot();

  const [selected, setSelected] = useState<string | null>(null);
  const [format, setFormat] = useState<ScreenshotFormat>('png');
  const [lastMsg, setLastMsg] = useState('');
  const captureRef = useRef<() => Promise<unknown>>(captureViewport);
  captureRef.current = captureViewport;

  const selectedShot = screenshots.find(s => s.id === selected) ?? null;

  async function handleCapture(mode: 'viewport' | 'fullpage') {
    const fn = mode === 'viewport' ? captureViewport : captureFullPage;
    const shot = await fn();
    if (shot) {
      setSelected(shot.id);
      setLastMsg(`Screenshot capturado: ${shot.width}×${shot.height}px (${formatSize(shot.fileSizeKB)})`);
      onCapture?.(mode, shot.fileSizeKB);
    }
  }

  void format; // format state used implicitly via hook options (future enhancement)

  return (
    <section className="screenshots-panel" aria-label="Captura de Screenshots">
      {/* Header */}
      <div className="sp-header">
        <h2>📸 Screenshots</h2>
        <div className="sp-controls">
          <select
            value={format}
            onChange={e => setFormat(e.target.value as ScreenshotFormat)}
            aria-label="Formato de saída"
            className="sp-format-select"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
          <button
            className="btn-capture"
            onClick={() => handleCapture('viewport')}
            disabled={capturing}
            aria-busy={capturing}
          >
            {capturing ? '⏳ Capturando…' : '📷 Viewport'}
          </button>
          <button
            className="btn-capture btn-fullpage"
            onClick={() => handleCapture('fullpage')}
            disabled={capturing}
            aria-busy={capturing}
          >
            {capturing ? '⏳ Capturando…' : '📄 Página inteira'}
          </button>
          {screenshots.length > 0 && (
            <>
              <button className="btn-secondary" onClick={downloadAll} title="Baixar todas">↓ Todas</button>
              <button className="btn-danger" onClick={clear} title="Limpar histórico">🗑 Limpar</button>
            </>
          )}
        </div>
      </div>

      {/* Status / erro */}
      {error && <p className="sp-error" role="alert">{error}</p>}
      {lastMsg && !error && <p className="sp-status" role="status">{lastMsg}</p>}

      {/* Conteúdo */}
      {screenshots.length === 0 ? (
        <div className="sp-empty">
          <p>Nenhum screenshot capturado ainda.</p>
          <p className="sp-hint">Use os botões acima para capturar o viewport ou a página inteira.</p>
        </div>
      ) : (
        <div className="sp-body">
          {/* Galeria de miniaturas */}
          <div className="ss-gallery" role="list" aria-label="Screenshots capturados">
            {screenshots.map(s => (
              <div role="listitem" key={s.id}>
                <Thumbnail
                  shot={s}
                  selected={selected === s.id}
                  onClick={() => setSelected(s.id)}
                  onDelete={() => {
                    remove(s.id);
                    if (selected === s.id) setSelected(null);
                  }}
                />
              </div>
            ))}
          </div>

          {/* Detalhe do selecionado */}
          {selectedShot ? (
            <ScreenshotDetail
              shot={selectedShot}
              onDownload={() => download(selectedShot.id)}
              onCopy={() => copyToClipboard(selectedShot.id)}
            />
          ) : (
            <div className="ss-detail-empty">
              <p>Selecione um screenshot para ver os detalhes.</p>
            </div>
          )}
        </div>
      )}

      {/* Contador */}
      {screenshots.length > 0 && (
        <div className="sp-footer">
          {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} em memória
          {' · '}
          {formatSize(screenshots.reduce((acc, s) => acc + s.fileSizeKB, 0))} total
        </div>
      )}
    </section>
  );
}
