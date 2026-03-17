import type { AgentZone } from '@amc/shared';
import { ZONE_LAYOUTS, DESK_OFFSETS } from './zone-types.js';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Assigns positions to agents within zones.
 * Agents sit at desks in work zones, and stand/wander in the coffee shop.
 */
export class ZoneManager {
  /**
   * Get the 3D position for an agent at a given slot within a zone.
   * In work zones, agents sit at desk positions.
   * In the coffee shop (idle), agents spread out casually.
   */
  getPositionForAgent(zone: AgentZone, slotIndex: number): Position3D {
    const layout = ZONE_LAYOUTS[zone];
    const desk = DESK_OFFSETS[slotIndex % DESK_OFFSETS.length];

    // For overflow beyond desk count, add row offset
    const overflow = Math.floor(slotIndex / DESK_OFFSETS.length);

    return {
      x: layout.center.x + desk.x + overflow * 0.5,
      y: 0,
      z: layout.center.z + desk.z + overflow * 0.5,
    };
  }
}
