import React, { useState } from 'react';
import { useAccessibilityTree } from '../hooks/useAccessibilityTree';
import { useMouseControl } from '../hooks/useMouseControl';
import '../styles/AccessibilityDemo.css';

export function AccessibilityDemo() {
  const {
    tree,
    focusableElements,
    captureTree,
    findElementByLabel,
    findElementByRole,
    getElementCenter,
    navigateByTab,
    activateElement,
  } = useAccessibilityTree();

  const {
    moveCursor,
    click,
    executeCommands,
    createVisualCursor,
    removeCursor,
  } = useMouseControl();

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  /**
   * Captura a árvore de acessibilidade
   */
  const handleCaptureTree = () => {
    const result = captureTree();
    console.log('Accessibility Tree:', result.tree);
    console.log('Focusable Elements:', result.focusable);
  };

  /**
   * Demonstra movimento do cursor para um elemento específico
   */
  const handleMoveToElement = async (label: string) => {
    setIsRunning(true);
    createVisualCursor();

    const element = findElementByLabel(label);
    if (element) {
      const center = getElementCenter(element);
      await moveCursor(center.x, center.y, 800);
      setSelectedElement(element.id);
    }

    setIsRunning(false);
  };

  /**
   * Clica em um elemento pela label
   */
  const handleClickElement = async (label: string) => {
    setIsRunning(true);
    createVisualCursor();

    const element = findElementByLabel(label);
    if (element) {
      const center = getElementCenter(element);
      await click(center.x, center.y, 'left');
      activateElement(element);
      setSelectedElement(element.id);
    }

    setIsRunning(false);
  };

  /**
   * Executa uma sequência de comandos em todos os elementos detectados
   */
  const handleExecuteSequence = async () => {
    if (focusableElements.length === 0) {
      const { focusable } = captureTree();
      if (focusable.length === 0) return;
    }

    setIsRunning(true);
    createVisualCursor();

    const commands = [];
    // Limitar a 15 elementos para não demorar demais, ou todos se forem poucos
    const targets = focusableElements.slice(0, 15);

    for (const element of targets) {
      const center = getElementCenter(element);
      commands.push({ type: 'move' as const, x: center.x, y: center.y, duration: 400 });
      commands.push({ type: 'click' as const, x: center.x, y: center.y });
    }

    await executeCommands(commands);

    setIsRunning(false);
  };

  /**
   * Navega usando Tab
   */
  const handleNavigateTab = () => {
    const nextElement = navigateByTab(true);
    if (nextElement) {
      setSelectedElement(nextElement.id);
    }
  };

  return (
    <div className="accessibility-demo">
      <div className="demo-header">
        <h1>🖱️ Mouse Automation via Accessibility Tree</h1>
        <p>Demonstração de controle de mouse usando a camada de acessibilidade</p>
      </div>

      <div className="demo-controls">
        <section className="control-group">
          <h2>Captura de Árvore de Acessibilidade</h2>
          <button onClick={handleCaptureTree} disabled={isRunning}>
            📋 Capturar Árvore
          </button>
          <p className="info">
            Elementos focáveis encontrados: <strong>{focusableElements.length}</strong>
          </p>
        </section>

        <section className="control-group">
          <h2>Movimento do Cursor</h2>
          <div className="button-group">
            <button
              onClick={() => handleMoveToElement('Enviar')}
              disabled={isRunning}
            >
              ➡️ Mover para Botão
            </button>
            <button
              onClick={() => handleMoveToElement('Nome')}
              disabled={isRunning}
            >
              ➡️ Mover para Input
            </button>
          </div>
        </section>

        <section className="control-group">
          <h2>Cliques e Interações</h2>
          <div className="button-group">
            <button
              onClick={() => handleClickElement('Enviar')}
              disabled={isRunning}
            >
              🖱️ Clicar em Botão
            </button>
            <button
              onClick={() => handleClickElement('Nome')}
              disabled={isRunning}
            >
              🖱️ Clicar em Input
            </button>
          </div>
        </section>

        <section className="control-group">
          <h2>Navegação por Teclado</h2>
          <button onClick={handleNavigateTab} disabled={isRunning}>
            ⌨️ Próximo Elemento (Tab)
          </button>
        </section>

        <section className="control-group">
          <h2>Sequência de Comandos</h2>
          <button onClick={handleExecuteSequence} disabled={isRunning}>
            ▶️ Executar Sequência
          </button>
          <p className="info">
            Executa uma série de movimentos e cliques automaticamente
          </p>
        </section>

        <section className="control-group">
          <h2>Limpeza</h2>
          <button onClick={removeCursor} disabled={isRunning}>
            🗑️ Remover Cursor Visual
          </button>
        </section>
      </div>

      <div className="demo-info">
        <h2>Elementos Focáveis Encontrados:</h2>
        <div className="elements-list">
          {focusableElements.slice(0, 10).map((element) => (
            <div
              key={element.id}
              className={`element-item ${selectedElement === element.id ? 'selected' : ''}`}
            >
              <span className="role">[{element.role}]</span>
              <span className="label">{element.label || '(sem label)'}</span>
              <span className="position">
                ({Math.round(element.x)}, {Math.round(element.y)})
              </span>
            </div>
          ))}
          {focusableElements.length > 10 && (
            <p className="more">... e mais {focusableElements.length - 10} elementos</p>
          )}
        </div>
      </div>

      <div className="demo-status">
        {isRunning && (
          <div className="status-running">
            ⏳ Executando automação...
          </div>
        )}
        {selectedElement && !isRunning && (
          <div className="status-success">
            ✅ Elemento selecionado: {selectedElement}
          </div>
        )}
      </div>

      {/* Elementos de teste */}
      <div className="test-elements" style={{ marginTop: '40px', padding: '20px', border: '1px solid #ccc' }}>
        <h3>Elementos de Teste</h3>
        <form>
          <div>
            <label htmlFor="test-input">Nome:</label>
            <input id="test-input" type="text" placeholder="Digite seu nome" />
          </div>
          <div>
            <label htmlFor="test-email">Email:</label>
            <input id="test-email" type="email" placeholder="seu@email.com" />
          </div>
          <button type="button">Enviar</button>
          <a href="#test">Link de Teste</a>
        </form>
      </div>
    </div>
  );
}
