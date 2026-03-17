import { AgentZone } from '@amc/shared';

export interface ZoneLayout {
  center: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  color: string;
  label: string;
  icon: string;
}

/**
 * Office floor plan layout.
 * Zones are arranged like departments in a real office:
 *
 *  ┌─────────────────────────────────────────────┐
 *  │  PLANNING/BA      │   CODING/DEV            │
 *  │  (whiteboards)    │   (workstations)         │
 *  │                   │                          │
 *  ├───────────────────┤──────────────────────────┤
 *  │  REVIEW/PR        │   TESTING/QA             │
 *  │  (meeting area)   │   (test stations)        │
 *  │                   │                          │
 *  ├───────────────────┴──────────────────────────┤
 *  │              COFFEE SHOP (idle)              │
 *  └─────────────────────────────────────────────┘
 */
export const ZONE_LAYOUTS: Record<AgentZone, ZoneLayout> = {
  [AgentZone.Planning]: {
    center: { x: -10, y: 0, z: -8 },
    size: { width: 14, height: 4, depth: 12 },
    color: '#f59e0b',
    label: 'PLANNING / BA',
    icon: '📋',
  },
  [AgentZone.Coding]: {
    center: { x: 10, y: 0, z: -8 },
    size: { width: 14, height: 4, depth: 12 },
    color: '#2563eb',
    label: 'CODING / DEV',
    icon: '💻',
  },
  [AgentZone.Review]: {
    center: { x: -10, y: 0, z: 6 },
    size: { width: 14, height: 4, depth: 10 },
    color: '#7c3aed',
    label: 'REVIEW / PR',
    icon: '🔍',
  },
  [AgentZone.Testing]: {
    center: { x: 10, y: 0, z: 6 },
    size: { width: 14, height: 4, depth: 10 },
    color: '#059669',
    label: 'TESTING / QA',
    icon: '🧪',
  },
  [AgentZone.Idle]: {
    center: { x: 0, y: 0, z: 18 },
    size: { width: 28, height: 4, depth: 8 },
    color: '#f97316',
    label: 'COFFEE SHOP',
    icon: '☕',
  },
};

/** Desk positions within each zone (relative to zone center) */
export const DESK_OFFSETS: { x: number; z: number }[] = [
  { x: -4, z: -2 },
  { x: -1, z: -2 },
  { x: 2, z: -2 },
  { x: 5, z: -2 },
  { x: -4, z: 2 },
  { x: -1, z: 2 },
  { x: 2, z: 2 },
  { x: 5, z: 2 },
];
