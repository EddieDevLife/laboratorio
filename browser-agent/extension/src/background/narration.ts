export interface BrowserAction {
  action: string;
  name?: string;
  role?: string;
  url?: string;
  text?: string;
  key?: string;
  reasoning?: string;
}

const TEMPLATES: Record<string, (a: BrowserAction) => string> = {
  click: (a) => a.name ? `Clicando em ${a.name}` : 'Clicando no elemento',
  type: (a) => a.name ? `Digitando em ${a.name}` : 'Digitando no campo',
  press_key: (a) => `Pressionando ${a.key ?? 'tecla'}`,
  scroll: () => 'Rolando a página',
  navigate: (a) => {
    try {
      const host = a.url ? new URL(a.url).hostname.replace('www.', '') : a.url;
      return `Navegando para ${host}`;
    } catch {
      return `Navegando para ${a.url ?? 'nova página'}`;
    }
  },
  wait: () => 'Aguardando carregamento',
  screenshot: () => 'Capturando tela',
  done: () => 'Tarefa concluída',
};

export function buildNarration(action: BrowserAction): string {
  const fn = TEMPLATES[action.action];
  return fn ? fn(action) : `Executando ${action.action}`;
}
