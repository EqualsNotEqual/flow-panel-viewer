import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { formatPropValue } from '../utils/graphData';
import { useZoomTier } from '../utils/zoom';

export interface FilterNodeData {
  label: string;
  color: string;
  condition?: string;
  properties?: Record<string, any>;
  showKeys?: string[];
}

const WIDTH = 110;
const HEIGHT = 64;

// Rendered as a diamond -- the standard flowchart shape for a decision/
// gate point -- so a Filter (a conditional routing gate) reads as
// structurally different from a regular system/venue card at a glance,
// not just differently colored. Drawn as an SVG polygon rather than a
// rotated/clip-path'd div: clip-path cuts a border unevenly along
// diagonal edges, where an SVG stroke stays a clean, uniform width.
export const FilterNode: React.FC<NodeProps<FilterNodeData>> = ({ data }) => {
  const zoomTier = useZoomTier();
  return (
    <div style={{ width: WIDTH, height: HEIGHT, position: 'relative' }} title={data.condition}>
      <Handle type="target" position={Position.Left} style={{ background: data.color, border: 'none' }} />
      <svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))' }}>
        <polygon
          points={`${WIDTH / 2},2 ${WIDTH - 2},${HEIGHT / 2} ${WIDTH / 2},${HEIGHT - 2} 2,${HEIGHT / 2}`}
          fill="#0f172a"
          stroke={data.color}
          strokeWidth={2}
        />
      </svg>
      {zoomTier !== 'far' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 26px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', lineHeight: 1.25 }}>{data.label}</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: data.color, border: 'none' }} />
      {zoomTier === 'close' && data.showKeys && data.showKeys.length > 0 && (
        // Absolutely positioned below the fixed-size diamond box so it
        // doesn't grow the node's own bounding box -- Handles stay anchored
        // to the diamond's actual tips regardless of how much extra text
        // is shown here.
        <div style={{ position: 'absolute', top: HEIGHT + 4, left: 0, width: WIDTH, textAlign: 'center' }}>
          {data.showKeys.map((k) => (
            <div key={k} style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.3 }}>
              {k}: {formatPropValue(data.properties?.[k])}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
