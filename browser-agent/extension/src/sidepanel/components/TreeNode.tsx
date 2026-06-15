import { useState } from 'react';
import type { AccessibilityNode } from '../../shared/types.js';

interface Props {
  node: AccessibilityNode;
  depth?: number;
}

export default function TreeNode({ node, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(depth < 2);

  const hasChildren = node.children.length > 0;
  const nodeClass = [
    'node',
    node.disabled ? 'node-disabled' : '',
    !node.visible ? 'node-hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={nodeClass}>
      <div
        className="node-header"
        onClick={() => hasChildren && setExpanded((e) => !e)}
        title={`nodeId: ${node.nodeId}`}
      >
        <span className="node-toggle">
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>
        <span className="node-role">{node.role}</span>
        {node.name && <span className="node-name">"{node.name}"</span>}
        {node.value && <span className="node-value">= {node.value}</span>}
      </div>

      {hasChildren && expanded && (
        <div className="node-children">
          {node.children.map((child) => (
            <TreeNode key={child.nodeId} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
