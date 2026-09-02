export interface NodeTypeColor {
  label: string;
  color: string;
}

export interface TopologyPanelOptions {
  nodeTypeColors: NodeTypeColor[];
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
  ],
};
