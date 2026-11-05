import type { SystemState } from '../../domain/content/schema';

/**
 * How a workshop system state is written for the player. Shared by the map and
 * by the "mission complete" screen, so the same repair reads the same way in
 * both places.
 */
export const STATE_LABEL: Record<SystemState, string> = {
  broken: 'averiado',
  working: 'operativo',
  reliable: 'fiable',
  absent: 'sin instalar',
  installed: 'instalado',
};
