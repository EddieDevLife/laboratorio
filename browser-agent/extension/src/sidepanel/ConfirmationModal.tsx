import { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  action: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmationModal({ action, onConfirm, onCancel }: ConfirmationModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 's' || e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key.toLowerCase() === 'n' || e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div style={{
        background: '#1c1c1e',
        border: '1px solid #3a3a3c',
        borderRadius: 12,
        padding: 20,
        maxWidth: 280,
        width: '100%',
      }}>
        <h2 id="confirm-title" style={{ margin: '0 0 8px', fontSize: 14, color: '#ff9f0a' }}>
          Confirmação necessária
        </h2>
        <p id="confirm-desc" style={{ margin: '0 0 16px', fontSize: 13, color: '#ebebf5' }}>
          Prestes a: <strong>{action}</strong>
          <br />
          <span style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'block' }}>
            Pressione S para confirmar ou N para cancelar
          </span>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            style={{ flex: 1, background: '#30d158', color: '#000', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 600 }}
          >
            Confirmar (S)
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, background: '#3a3a3c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}
          >
            Cancelar (N)
          </button>
        </div>
      </div>
    </div>
  );
}
