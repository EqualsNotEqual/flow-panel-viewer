export interface NodeTypeColor {
  label: string;
  color: string;
  icon?: string;
}

export interface EdgeTypeColor {
  label: string;
  color: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface TopologyPanelOptions {
  nodeTypeColors: NodeTypeColor[];
  edgeTypeColors: EdgeTypeColor[];
  groupByLabel: boolean;
}

// These six are today's real business node types (trade topology's palette,
// lifted from the reference mockup) — the default value for the option, so
// nothing changes visually out of the box. Editable in Panel options because
// the enum grows over time, but it's a small, known, finite list — not the
// open-ended set of labels you'd see loading an arbitrary exploration
// dataset, which is why there's no auto-generated fallback color here.
export const defaultTopologyPanelOptions: TopologyPanelOptions = {
  nodeTypeColors: [
    { label: 'Desk', color: '#3b82f6' },
    { label: 'Venue', color: '#8b5cf6' },
    { label: 'Destination', color: '#a78bfa' },
    { label: 'Software', color: '#10b981' },
    { label: 'Vendor', color: '#14b8a6' },
    { label: 'Host', color: '#6ee7b7' },
    { label: 'Filter', color: '#f59e0b' },
  ],
  // No presets here (unlike nodeTypeColors) -- relationship types are
  // whatever the schema in use happens to call them, with no fixed enum to
  // pre-populate. Add a row per type as needed; anything unmapped falls
  // back to the default blue used before this option existed.
  edgeTypeColors: [],
  // Off by default -- preserves every existing panel's current layout
  // unchanged. Real layout-shape change, not just decoration: clusters
  // nodes sharing a first label together, which helps when a label has many
  // natural peers that should visually sit together but can pull nodes away
  // from their actual position in a routing sequence elsewhere -- an
  // explicit per-panel choice, not a new universal default.
  groupByLabel: false,
};
