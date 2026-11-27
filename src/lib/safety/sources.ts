/** Every published danger zone number and citation. Geometry and legends read from here. */

export const FT_PER_M = 1 / 0.3048;

export type SplashSourceId = 'ar385-splash' | 'pnz-splash';
export type FanSourceId = 'fan-9mm' | 'fan-556';
export type LayerId = SplashSourceId | FanSourceId;

export const LAYER_IDS: readonly LayerId[] = ['ar385-splash', 'pnz-splash', 'fan-9mm', 'fan-556'];

export type SplashSource = {
	id: SplashSourceId;
	label: string;
	angleDeg: number;
	reachM: number;
	/** 'limit': the reach is an outer bound. 'minimum': it may go further (no stated limit). */
	reachKind: 'limit' | 'minimum';
	/** Lower end of a published range ("25–30 m"), when the source gives one. */
	reachFromM?: number;
	citation: string;
	meaning: string;
};

export type FanSource = {
	id: FanSourceId;
	label: string;
	load: string;
	dispersionDeg: number;
	xM: number;
	yM: number;
	wM: number;
	pDeg: number;
	qDeg: number;
	citation: string;
	meaning: string;
};

export const SPLASH_SOURCES: Record<SplashSourceId, SplashSource> = {
	'ar385-splash': {
		id: 'ar385-splash',
		label: 'AR 385-63 splash',
		angleDeg: 20,
		reachM: 45.72,
		reachKind: 'limit',
		citation: 'AR 385-63/MCO 3570.1D (23 May 2025), ¶2-17a(2), Fig. 2-5',
		meaning:
			'bullet splatter will angle off the target up to 20 degrees… and travel up to 45 m. The majority of all bullet fragments will exit the target within the 20-degree backsplash area'
	},
	'pnz-splash': {
		id: 'pnz-splash',
		label: 'Pistol NZ splash',
		angleDeg: 20,
		reachM: 30,
		reachKind: 'minimum',
		reachFromM: 25,
		citation:
			'Pistol New Zealand, Steel Target Safe Use Guide 2025 V4 (28 May 2025), §8 "What happens when a projectile hits Steel? The Splatter Pattern", p. 6, Fig. 1',
		meaning:
			'splatter sideways at least 25-30 metres… you must assume that the side splatter can cause injury at any distance within the splatter zone'
	}
};

const FAN_MEANING =
	'Danger zone = 1 in 1,000,000 escape envelope (AR 385-63 ¶3-1b), not where rounds usually go.';

export const FAN_SOURCES: Record<FanSourceId, FanSource> = {
	'fan-9mm': {
		id: 'fan-9mm',
		label: '9mm Luger',
		load: 'Ball M882, M1, subsonic',
		dispersionDeg: 5,
		xM: 1800,
		yM: 1211,
		wM: 399,
		pDeg: 61.1,
		qDeg: 30.4,
		citation: 'AR 385-63, ¶5-1c, Fig. 5-3, Table 5-4 (steel/concrete)',
		meaning: FAN_MEANING
	},
	'fan-556': {
		id: 'fan-556',
		label: '5.56 NATO',
		load: 'M193 Ball',
		dispersionDeg: 5,
		xM: 3100,
		yM: 1666,
		wM: 323,
		pDeg: 19.0,
		qDeg: 26.9,
		citation: 'AR 385-63, ¶5-1c, Fig. 5-3, Table 5-11 (steel/concrete)',
		meaning: FAN_MEANING
	}
};

/** The source record behind a toggle, splash or fan. */
export function layerSource(id: LayerId): SplashSource | FanSource {
	return id in SPLASH_SOURCES
		? SPLASH_SOURCES[id as SplashSourceId]
		: FAN_SOURCES[id as FanSourceId];
}

export const LEGEND_NO_BERMS = 'Berms and baffles are not modeled.';
