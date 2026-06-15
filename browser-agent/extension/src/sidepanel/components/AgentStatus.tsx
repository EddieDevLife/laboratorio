import type { AgentStatus } from '../../shared/types.js';

const LABELS: Record<AgentStatus, string> = {
  idle: 'Aguardando',
  scanning: 'Escaneando...',
  running: 'Executando',
  waiting: 'Aguardando LLM',
  error: 'Erro',
};

export default function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {LABELS[status]}
    </span>
  );
}
