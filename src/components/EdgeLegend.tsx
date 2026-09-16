import React from 'react';
import { EdgeTypeColor } from '../types';

const LINE_PATTERNS: Record<string, string> = {
  dashed: '6,4',
  dotted: '2,3',
};

// Fully data-driven off whatever's already configured in Panel options ->
// Flow Options -> Edge type colors -- no separate legend-authoring step,
// and nothing to keep in sync by hand. Renders nothing when no edge types
// are configured, since an empty legend explaining nothing isn't useful.
export const EdgeLegend: React.FC<{ edgeTypeColors: EdgeTypeColor[] }> = ({ edgeTypeColors }) => {
  if (edgeTypeColors.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        zIndex: 4,
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(6px)',
        border: '1px solid #334155',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 8 }}>
        KEY / LEGEND
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
        {edgeTypeColors.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="6" style={{ flexShrink: 0 }}>
              <line
                x1="0"
                y1="3"
                x2="28"
                y2="3"
                stroke={c.color}
                strokeWidth={2.5}
                strokeDasharray={c.lineStyle ? LINE_PATTERNS[c.lineStyle] : undefined}
              />
            </svg>
            <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
