import { describe, expect, it } from 'vitest';
import {
	FAN_SOURCES,
	FT_PER_M,
	LAYER_IDS,
	LEGEND_MARKS,
	LEGEND_NO_BERMS,
	SPLASH_SOURCES,
	layerSource
} from './sources';

const FAN_MEANING =
	'Danger zone = 1 in 1,000,000 escape envelope (AR 385-63 ¶3-1b), not where rounds usually go.';

describe('danger zone sources', () => {
	it('converts meters to feet exactly', () => {
		expect(45.72 * FT_PER_M).toBeCloseTo(150, 9);
	});

	it('lists layers in toggle order', () => {
		expect(LAYER_IDS).toEqual(['ar385-splash', 'pnz-splash', 'fan-9mm', 'fan-556']);
	});

	it('looks up every layer source by id', () => {
		expect(LAYER_IDS.map((id) => layerSource(id).id)).toEqual(LAYER_IDS);
		expect(LAYER_IDS.map((id) => layerSource(id).label)).toEqual([
			'AR 385-63 splash',
			'Pistol NZ splash',
			'9mm Luger',
			'5.56 NATO'
		]);
	});

	it('records the AR 385-63 splash', () => {
		const s = SPLASH_SOURCES['ar385-splash'];
		expect(s.label).toBe('AR 385-63 splash');
		expect(s.angleDeg).toBe(20);
		expect(s.reachM).toBe(45.72);
		expect(s.reachKind).toBe('limit');
		expect(s.reachFromM).toBeUndefined();
		expect(s.citation).toBe('AR 385-63/MCO 3570.1D (23 May 2025), ¶2-17a(2), Fig. 2-5');
		expect(s.meaning).toBe(
			'bullet splatter will angle off the target up to 20 degrees… and travel up to 45 m. The majority of all bullet fragments will exit the target within the 20-degree backsplash area'
		);
	});

	it('records the Pistol NZ splash', () => {
		const s = SPLASH_SOURCES['pnz-splash'];
		expect(s.label).toBe('Pistol NZ splash');
		expect(s.angleDeg).toBe(20);
		expect(s.reachM).toBe(30);
		expect(s.reachFromM).toBe(25);
		expect(s.reachKind).toBe('minimum');
		expect(s.citation).toBe(
			'Pistol New Zealand, Steel Target Safe Use Guide 2025 V4 (28 May 2025), §8 "What happens when a projectile hits Steel? The Splatter Pattern", p. 6, Fig. 1'
		);
		expect(s.meaning).toBe(
			'splatter sideways at least 25-30 metres… you must assume that the side splatter can cause injury at any distance within the splatter zone'
		);
	});

	it('records the 9mm fan', () => {
		const f = FAN_SOURCES['fan-9mm'];
		expect(f).toMatchObject({
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
		});
	});

	it('records the 5.56 fan', () => {
		const f = FAN_SOURCES['fan-556'];
		expect(f).toMatchObject({
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
		});
	});

	it('states that berms are not modeled', () => {
		expect(LEGEND_NO_BERMS).toBe('Berms and baffles are not modeled.');
	});

	it('explains the marks on the canvas', () => {
		expect(LEGEND_MARKS).toEqual({
			dispersion:
				'Thin lines: dispersion area, 5° each side of the line of fire (AR 385-63 ¶5-1d, Fig. 5-3).',
			fanLetters:
				'X = maximum range (AR 385-63 ¶9-2d); W = ricochet width beyond the dispersion edge; Y = farthest downrange point of a lateral ricochet (¶5-2b).',
			noLimit: 'Dotted continuation: Pistol NZ gives no outer limit.',
			pastBay: '“past bay” distances are computed by Match Sketch from this plan, not published.'
		});
	});

	it('adds a note where the drawing makes a choice the source leaves open', () => {
		expect(SPLASH_SOURCES['ar385-splash'].note).toBe('Drawn to Fig. 2-5’s 50 yd (45.72 m).');
		expect(FAN_SOURCES['fan-556'].note).toBe(
			'M193 is the only 5.56 ball load AR 385-63 gives steel-impact data for (Table 5-11); M855 (Table 5-12) lists only earth and armor.'
		);
		expect(SPLASH_SOURCES['pnz-splash'].note).toBeUndefined();
		expect(FAN_SOURCES['fan-9mm'].note).toBeUndefined();
	});
});
