import {
  Activity,
  Briefcase,
  Building2,
  CircleDollarSign,
  Cpu,
  Database,
  FileChartColumn,
  House,
  Landmark,
  Link2,
  Network,
  Server,
  Shield,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

// A curated set of real, distinctive pictograms (vs. @grafana/ui's more
// general dashboard-chrome icon set) -- keyed by a plain string name so
// NodeTypeColorEditor's existing icon Combobox can list these alongside
// Grafana's own icons without a separate picker. Checked here first by
// whatever renders a node's icon; falls back to the Grafana icon set for
// any name not in this map.
export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  building: Building2,
  briefcase: Briefcase,
  house: House,
  'trending-up': TrendingUp,
  server: Server,
  database: Database,
  activity: Activity,
  'file-chart': FileChartColumn,
  target: Target,
  network: Network,
  shield: Shield,
  link: Link2,
  landmark: Landmark,
  cpu: Cpu,
  'dollar-sign': CircleDollarSign,
};

export function isLucideIconName(name: string | undefined): boolean {
  return !!name && name in LUCIDE_ICONS;
}
