import { useStore } from 'reactflow';

export type ZoomTier = 'far' | 'mid' | 'close';

// Google-Maps-style graduated detail: shape/color alone from far out (you
// see NYC's outline, not street names), the primary label once you're
// closer (5th Avenue), full detail -- sublabel, right-click/displayAttribute
// picks -- only once properly zoomed in (Rockefeller Center's own signage).
// A selector returning the TIER (not the raw zoom number) means a component
// only re-renders when it actually crosses into a new tier, not on every
// pan/zoom tick -- state.transform is [x, y, zoom].
const MID_THRESHOLD = 0.3;
const CLOSE_THRESHOLD = 0.8;

export function useZoomTier(): ZoomTier {
  return useStore((s) => {
    const zoom = s.transform[2];
    if (zoom >= CLOSE_THRESHOLD) return 'close';
    if (zoom >= MID_THRESHOLD) return 'mid';
    return 'far';
  });
}
