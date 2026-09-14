import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Icon, toIconName } from '@grafana/ui';
import { formatPropValue } from '../utils/graphData';
import { useZoomTier } from '../utils/zoom';

export interface TopologyNodeData {
  label: string;
  sublabel: string;
  color: string;
  icon?: string;
  url?: string;
  properties?: Record<string, any>;
  showKeys?: string[];
}

// Metrics/palette lifted from the reference mockup (Tailwind slate-950
// background, bold slate-50 name + slate-400 type, 8px radius, 2px border).
export const TopologyNode: React.FC<NodeProps<TopologyNodeData>> = ({ data }) => {
  const iconName = data.icon ? toIconName(data.icon) : undefined;
  const zoomTier = useZoomTier();
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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: data.url ? 'pointer' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color, border: 'none' }} />
      {iconName && <Icon name={iconName} size="lg" style={{ color: data.color, flexShrink: 0 }} />}
      {zoomTier !== 'far' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 }}>{data.label}</div>
          {zoomTier === 'close' && (
            <>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.35 }}>{data.sublabel}</div>
              {data.showKeys?.map((k) => (
                <div key={k} style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.35 }}>
                  {k}: {formatPropValue(data.properties?.[k])}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {zoomTier === 'close' && data.url && <Icon name="external-link-alt" size="sm" style={{ color: '#94a3b8', flexShrink: 0 }} />}
      <Handle type="source" position={Position.Right} style={{ background: data.color, border: 'none' }} />
    </div>
  );
};
