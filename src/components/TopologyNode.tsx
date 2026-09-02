import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface TopologyNodeData {
  label: string;
  sublabel: string;
  color: string;
}

// Metrics/palette lifted from the reference mockup (Tailwind slate-950
// background, bold slate-50 name + slate-400 type, 8px radius, 2px border).
export const TopologyNode: React.FC<NodeProps<TopologyNodeData>> = ({ data }) => {
  return (
    <div
      style={{
        border: `2px solid ${data.color}`,
        borderRadius: 8,
        padding: '8px 12px',
        background: '#0f172a',
        minWidth: 140,
        minHeight: 44,
        textAlign: 'left',
        boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color, border: 'none' }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 }}>{data.label}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.35 }}>{data.sublabel}</div>
      <Handle type="source" position={Position.Right} style={{ background: data.color, border: 'none' }} />
    </div>
  );
};
