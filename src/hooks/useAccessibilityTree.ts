import { useState, useCallback } from 'react';

export interface AccessibilityNode {
  id: string;
  role: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  focusable: boolean;
  visible: boolean;
  children: AccessibilityNode[];
  element?: HTMLElement;
}

/**
 * Hook para capturar e gerenciar a árvore de acessibilidade (Accessibility Tree)
 * da página atual
 */
export function useAccessibilityTree() {
  const [tree, setTree] = useState<AccessibilityNode | null>(null);
  const [focusableElements, setFocusableElements] = useState<AccessibilityNode[]>([]);

  /**
   * Extrai informações de acessibilidade de um elemento
   */
  const getAccessibilityInfo = useCallback((element: HTMLElement): Partial<AccessibilityNode> => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';

    // Determinar o papel (role) do elemento
    let role = element.getAttribute('role') || element.tagName.toLowerCase();
    
    // Mapear tags HTML para roles ARIA
    const roleMap: Record<string, string> = {
      button: 'button',
      a: 'link',
      input: 'textbox',
      textarea: 'textbox',
      select: 'combobox',
      img: 'img',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      form: 'form',
      nav: 'navigation',
      main: 'main',
      section: 'region',
      article: 'article',
      header: 'banner',
      footer: 'contentinfo',
    };

    role = roleMap[role] || role;

    // Extrair label/nome acessível
    let label = 
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent?.trim().substring(0, 100) ||
      '';

    // Para inputs, usar placeholder ou label associado
    if (element instanceof HTMLInputElement) {
      label = element.placeholder || element.value || label;
    }

    // Extrair descrição
    const description = element.getAttribute('aria-description');

    // Determinar se é focável
    const focusable = 
      element.hasAttribute('tabindex') ||
      ['button', 'a', 'input', 'select', 'textarea'].includes(element.tagName.toLowerCase()) ||
      element.hasAttribute('role');

    return {
      role,
      label,
      description: description || undefined,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      focusable,
      visible: isVisible,
    };
  }, []);

  /**
   * Constrói recursivamente a árvore de acessibilidade
   */
  const buildAccessibilityTree = useCallback((
    element: HTMLElement,
    parentId: string = 'root'
  ): AccessibilityNode => {
    const id = `${parentId}-${Math.random().toString(36).substr(2, 9)}`;
    const info = getAccessibilityInfo(element);

    const node: AccessibilityNode = {
      id,
      role: info.role || 'generic',
      label: info.label || '',
      description: info.description,
      x: info.x || 0,
      y: info.y || 0,
      width: info.width || 0,
      height: info.height || 0,
      focusable: info.focusable || false,
      visible: info.visible !== false,
      children: [],
      element,
    };

    // Processar filhos (apenas elementos com role ou interativos)
    const children = Array.from(element.children) as HTMLElement[];
    for (const child of children) {
      // Pular elementos ocultos ou muito pequenos
      const childRect = child.getBoundingClientRect();
      if (childRect.width > 0 && childRect.height > 0) {
        const childNode = buildAccessibilityTree(child, id);
        // Incluir apenas nós focáveis ou com conteúdo significativo
        if (childNode.focusable || childNode.label) {
          node.children.push(childNode);
        }
      }
    }

    return node;
  }, [getAccessibilityInfo]);

  /**
   * Captura a árvore de acessibilidade da página
   */
  const captureTree = useCallback(() => {
    const root = document.documentElement;
    const tree = buildAccessibilityTree(root);
    setTree(tree);

    // Extrair todos os elementos focáveis
    const focusable: AccessibilityNode[] = [];
    const traverse = (node: AccessibilityNode) => {
      if (node.focusable && node.visible) {
        focusable.push(node);
      }
      node.children.forEach(traverse);
    };
    traverse(tree);

    setFocusableElements(focusable);
    return { tree, focusable };
  }, [buildAccessibilityTree]);

  /**
   * Encontra um elemento pela label
   */
  const findElementByLabel = useCallback((label: string): AccessibilityNode | null => {
    if (!tree) return null;

    const search = (node: AccessibilityNode): AccessibilityNode | null => {
      if (node.label.toLowerCase().includes(label.toLowerCase())) {
        return node;
      }
      for (const child of node.children) {
        const result = search(child);
        if (result) return result;
      }
      return null;
    };

    return search(tree);
  }, [tree]);

  /**
   * Encontra um elemento pelo role
   */
  const findElementByRole = useCallback((role: string, index: number = 0): AccessibilityNode | null => {
    if (!tree) return null;

    let count = 0;
    const search = (node: AccessibilityNode): AccessibilityNode | null => {
      if (node.role === role) {
        if (count === index) return node;
        count++;
      }
      for (const child of node.children) {
        const result = search(child);
        if (result) return result;
      }
      return null;
    };

    return search(tree);
  }, [tree]);

  /**
   * Obtém o centro de um elemento
   */
  const getElementCenter = useCallback((node: AccessibilityNode): { x: number; y: number } => {
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    };
  }, []);

  /**
   * Simula navegação por teclado (Tab)
   */
  const navigateByTab = useCallback((forward: boolean = true): AccessibilityNode | null => {
    if (focusableElements.length === 0) return null;

    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = focusableElements.findIndex(
      (el) => el.element === currentElement
    );

    let nextIndex = forward ? currentIndex + 1 : currentIndex - 1;
    
    // Circular navigation
    if (nextIndex >= focusableElements.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = focusableElements.length - 1;

    const nextElement = focusableElements[nextIndex];
    nextElement.element?.focus();

    return nextElement;
  }, [focusableElements]);

  /**
   * Ativa um elemento (simula clique)
   */
  const activateElement = useCallback((node: AccessibilityNode): void => {
    if (!node.element) return;

    node.element.focus();

    // Simular clique
    if (node.element instanceof HTMLButtonElement || node.element instanceof HTMLAnchorElement) {
      node.element.click();
    } else if (node.element instanceof HTMLInputElement) {
      node.element.focus();
      node.element.select();
    }
  }, []);

  return {
    tree,
    focusableElements,
    captureTree,
    findElementByLabel,
    findElementByRole,
    getElementCenter,
    navigateByTab,
    activateElement,
  };
}
