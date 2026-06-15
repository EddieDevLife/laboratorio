import { useCallback, useRef } from 'react';

export interface MouseCommand {
  type: 'move' | 'click' | 'doubleClick' | 'rightClick' | 'drag';
  x: number;
  y: number;
  duration?: number; // Duração da animação em ms
  button?: 'left' | 'right' | 'middle';
  toX?: number; // Para drag
  toY?: number; // Para drag
}

/**
 * Hook para controlar o movimento do mouse e simular cliques
 * Usa a Accessibility Tree para navegar e interagir com elementos
 */
export function useMouseControl() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const commandQueueRef = useRef<MouseCommand[]>([]);
  const isMovingRef = useRef(false);

  /**
   * Cria um cursor visual na página (para debug/visualização)
   */
  const createVisualCursor = useCallback(() => {
    if (cursorRef.current) return;

    const cursor = document.createElement('div');
    cursor.id = 'mouse-automation-cursor';
    cursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border: 2px solid #ff0000;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      display: none;
      box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
      transition: all 0.1s ease-out;
    `;
    document.body.appendChild(cursor);
    cursorRef.current = cursor;
  }, []);

  /**
   * Move o cursor para uma posição específica com animação suave
   */
  const moveCursor = useCallback(async (
    x: number,
    y: number,
    duration: number = 500
  ): Promise<void> => {
    return new Promise((resolve) => {
      createVisualCursor();
      if (!cursorRef.current) {
        resolve();
        return;
      }

      isMovingRef.current = true;
      const cursor = cursorRef.current;
      const startX = parseFloat(cursor.style.left) || 0;
      const startY = parseFloat(cursor.style.top) || 0;
      const startTime = Date.now();

      cursor.style.display = 'block';

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out-cubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentX = startX + (x - startX) * easeProgress;
        const currentY = startY + (y - startY) * easeProgress;

        cursor.style.left = `${currentX - 10}px`;
        cursor.style.top = `${currentY - 10}px`;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          isMovingRef.current = false;
          resolve();
        }
      };

      animate();
    });
  }, [createVisualCursor]);

  /**
   * Simula um clique do mouse garantindo foco e interação real
   */
  const click = useCallback(async (
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left'
  ): Promise<void> => {
    // Primeiro, mover o cursor para a posição
    await moveCursor(x, y, 300);

    // Encontrar o elemento na posição
    const element = document.elementFromPoint(x, y) as HTMLElement;
    
    if (element) {
      // Garantir foco para simular interação real
      element.focus();

      // Criar e disparar evento de mouse
      const buttonCode = button === 'left' ? 0 : button === 'right' ? 2 : 1;
      
      const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        buttons: 1 << buttonCode,
        button: buttonCode,
      };

      element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      await new Promise(resolve => setTimeout(resolve, 50));
      element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      await new Promise(resolve => setTimeout(resolve, 50));
      element.dispatchEvent(new MouseEvent('click', eventOptions));

      // Se for um input, dar foco explicitamente e selecionar se possível
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        if (element.type === 'text' || element.type === 'email' || element.type === 'password') {
          element.select();
        }
      } 
      // Se for um link ou botão, chamar click() nativo também
      else if (element instanceof HTMLAnchorElement || element instanceof HTMLButtonElement) {
        element.click();
      }
    }
  }, [moveCursor]);

  /**
   * Simula um duplo clique
   */
  const doubleClick = useCallback(async (
    x: number,
    y: number
  ): Promise<void> => {
    await click(x, y, 'left');
    await new Promise(resolve => setTimeout(resolve, 100));
    await click(x, y, 'left');
  }, [click]);

  /**
   * Simula um clique direito
   */
  const rightClick = useCallback(async (
    x: number,
    y: number
  ): Promise<void> => {
    await click(x, y, 'right');
  }, [click]);

  /**
   * Simula um arrasto (drag)
   */
  const drag = useCallback(async (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number = 500
  ): Promise<void> => {
    const element = document.elementFromPoint(fromX, fromY) as HTMLElement;
    
    if (element) {
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: fromX,
        clientY: fromY,
      });
      
      element.dispatchEvent(mouseDownEvent);
      await moveCursor(toX, toY, duration);
      
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: toX,
        clientY: toY,
      });
      
      element.dispatchEvent(mouseUpEvent);
    }
  }, [moveCursor]);

  /**
   * Executa uma fila de comandos sequencialmente
   */
  const executeCommands = useCallback(async (
    commands: MouseCommand[]
  ): Promise<void> => {
    for (const command of commands) {
      switch (command.type) {
        case 'move':
          await moveCursor(command.x, command.y, command.duration || 500);
          break;
        case 'click':
          await click(command.x, command.y, command.button || 'left');
          break;
        case 'doubleClick':
          await doubleClick(command.x, command.y);
          break;
        case 'rightClick':
          await rightClick(command.x, command.y);
          break;
        case 'drag':
          if (command.toX !== undefined && command.toY !== undefined) {
            await drag(command.x, command.y, command.toX, command.toY, command.duration || 500);
          }
          break;
      }
      // Pequena pausa entre comandos
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [moveCursor, click, doubleClick, rightClick, drag]);

  /**
   * Oculta o cursor visual
   */
  const hideCursor = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.style.display = 'none';
    }
  }, []);

  /**
   * Remove o cursor visual
   */
  const removeCursor = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.remove();
      cursorRef.current = null;
    }
  }, []);

  /**
   * Obtém a posição atual do cursor visual
   */
  const getCursorPosition = useCallback((): { x: number; y: number } => {
    if (!cursorRef.current) return { x: 0, y: 0 };
    return {
      x: parseFloat(cursorRef.current.style.left) + 10,
      y: parseFloat(cursorRef.current.style.top) + 10,
    };
  }, []);

  return {
    moveCursor,
    click,
    doubleClick,
    rightClick,
    drag,
    executeCommands,
    createVisualCursor,
    hideCursor,
    removeCursor,
    getCursorPosition,
  };
}
