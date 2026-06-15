import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { ConfirmationModal } from '../ConfirmationModal.js';

describe('ConfirmationModal', () => {
  it('renderiza a ação descrita', () => {
    render(<ConfirmationModal action="Confirmar pedido" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Confirmar pedido')).toBeInTheDocument();
  });

  it('foco vai para botão Confirmar ao montar', () => {
    render(<ConfirmationModal action="x" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /confirmar/i }));
  });

  it('S chama onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmationModal action="x" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.keyDown(document, { key: 's' });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('Enter chama onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmationModal action="x" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('N chama onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmationModal action="x" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'n' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape chama onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmationModal action="x" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
