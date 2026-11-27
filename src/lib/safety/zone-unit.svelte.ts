import type { ZoneUnit } from './paths';

/** The unit danger zone edge tags use on this device; loaded with the app (see +layout.ts). */
export const zoneUnit = $state<{ value: ZoneUnit }>({ value: 'yd' });
