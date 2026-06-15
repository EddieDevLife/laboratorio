import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAccessibilityTree } from '../hooks/useAccessibilityTree';
import { useMouseControl } from '../hooks/useMouseControl';
import '../styles/CommandCenter.css';

interface CommandLog {
  id: string;
  type: 'input' | 'output' | 'error';
  text: string;
  timestamp: Date;
}

export function CommandCenter() {
  const {
    tree,
    focusableElements,
    captureTree,
    findElementByLabel,
    getElementCenter,
    activateElement,
    navigateByTab,
  } = useAccessibilityTree();

  const {
    moveCursor,
    click,
    getCursorPosition,
    createVisualCursor,
  } = useMouseControl();

  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final dos logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Capturar árvore inicial
  useEffect(() => {
    captureTree();
  }, [captureTree]);

  // Sincronizar cursor visual com o foco (Tab navigation)
  useEffect(() => {
    const syncCursorWithFocus = async () => {
      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement || activeElement === document.body || activeElement.tagName === 'INPUT' && activeElement.parentElement?.className === 'terminal-input') return;

      const rect = activeElement.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      createVisualCursor();
      await moveCursor(x, y, 300);
    };

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Tab') {
        syncCursorWithFocus();
      }
    });

    return () => window.removeEventListener('keyup', syncCursorWithFocus);
  }, [createVisualCursor, moveCursor]);

  const addLog = useCallback((text: string, type: 'input' | 'output' | 'error' = 'output') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text,
      timestamp: new Date(),
    }]);
  }, []);

  // Handler para a barra de espaço
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Se estiver digitando no input do terminal, não dispara o clique
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        const pos = getCursorPosition();
        if (pos.x > 0 || pos.y > 0) {
          addLog('Barra de Espaço pressionada: Clicando...', 'output');
          await click(pos.x, pos.y);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [click, getCursorPosition, addLog]);

  const processCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    addLog(cmd, 'input');
    setIsProcessing(true);
    createVisualCursor();

    try {
      // 1. Numeric Command: "1", "2", etc.
      if (/^\d+$/.test(trimmedCmd)) {
        const index = parseInt(trimmedCmd) - 1;
        if (index >= 0 && index < focusableElements.length) {
          const element = focusableElements[index];
          const center = getElementCenter(element);
          addLog(`Movendo para o componente #${trimmedCmd}: "${element.label || element.role}"...`);
          await moveCursor(center.x, center.y, 600);
          
          // DAR FOCO AO ELEMENTO APÓS O MOVIMENTO
          if (element.element) {
            element.element.focus();
            addLog(`Foco aplicado ao componente #${trimmedCmd}.`);
          }
        } else {
          throw new Error(`Índice ${trimmedCmd} inválido. Use números de 1 a ${focusableElements.length}.`);
        }
      }
      
      // 2. Click Command: click "Label"
      else if (trimmedCmd.toLowerCase().startsWith('click')) {
        const target = cmd.match(/click\s+["'](.+?)["']/i)?.[1] || trimmedCmd.replace('click', '').trim();
        const element = findElementByLabel(target);
        if (!element) throw new Error(`Elemento "${target}" não encontrado.`);

        const center = getElementCenter(element);
        addLog(`Clicando em "${element.label}"...`);
        await click(center.x, center.y, 'left');
        activateElement(element);
      } 

      // 3. Reload Command
      else if (['reload', 'refresh', 'capture'].includes(trimmedCmd.toLowerCase())) {
        captureTree();
        addLog('Árvore de acessibilidade atualizada.');
      }

      // 4. Help
      else if (trimmedCmd.toLowerCase() === 'help') {
        addLog('Comandos disponíveis:');
        addLog('- [Número]: Move o mouse para o componente da lista');
        addLog('- click "nome": Clica em um elemento');
        addLog('- reload: Atualiza a lista de componentes');
        addLog('- [ESPAÇO]: Clica na posição atual do mouse');
      }

      else {
        addLog(`Comando não reconhecido: "${cmd}". Digite "help" para ver a lista.`, 'error');
      }

    } catch (err: any) {
      addLog(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    processCommand(input);
    setInput('');
  };

  return (
    <div className="command-center">
      <div className="terminal-header">
        <span className="dot red"></span>
        <span className="dot yellow"></span>
        <span className="dot green"></span>
        <span className="title">Terminal de Automação V2</span>
      </div>
      
      <div className="terminal-body" ref={scrollRef}>
        <div className="welcome-msg">
          Pronto. Use números (1, 2...) para navegar ou ESPAÇO para clicar.
        </div>
        
        {/* Lista de componentes numerados para facilitar o uso do usuário */}
        <div className="component-indices">
          <strong>Componentes detectados:</strong>
          <div className="indices-grid">
            {focusableElements.slice(0, 15).map((el, idx) => (
              <span key={el.id} className="index-tag">
                {idx + 1}: {el.label || el.role}
              </span>
            ))}
          </div>
        </div>

        {logs.map(log => (
          <div key={log.id} className={`log-entry ${log.type}`}>
            <span className="timestamp">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className="prefix">{log.type === 'input' ? '>' : '#'}</span>
            <span className="text">{log.text}</span>
          </div>
        ))}
        {isProcessing && (
          <div className="log-entry output processing">
            <span className="prefix">#</span>
            <span className="text">Processando movimento...</span>
          </div>
        )}
      </div>

      <form className="terminal-input" onSubmit={handleSubmit}>
        <span className="prompt">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite o número do componente..."
          disabled={isProcessing}
          autoFocus
        />
      </form>
    </div>
  );
}
