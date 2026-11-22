import type { CatalogEntry, SymbolEntry, SymbolFamily } from './types';

/** Every symbol's SVG (`svg/<id>.svg`), bundled as text. */
const SVGS = import.meta.glob<string>('./svg/*.svg', {
	query: '?raw',
	import: 'default',
	eager: true
});

function svgFor(id: string): string {
	const svg = SVGS[`./svg/${id}.svg`];
	if (!svg) throw new Error(`Missing symbol art: svg/${id}.svg`);
	return svg;
}

/** Families group variants of one target type in the palette (spec §7.1, §7.7). */
export const FAMILIES: Readonly<Record<string, SymbolFamily>> = {
	paper: { id: 'paper', name: 'Paper' },
	poppers: { id: 'poppers', name: 'Poppers' },
	steel: { id: 'steel', name: 'Steel' },
	movers: { id: 'movers', name: 'Movers' }
};

type TargetExtra = Partial<Pick<SymbolEntry, 'plural' | 'keepCase'>>;

/** A standing, front-facing target: countable, anchored at its base. */
function target(
	id: string,
	name: string,
	family: string,
	aliases: string[],
	extra: TargetExtra = {}
): SymbolEntry {
	return {
		id,
		name,
		aliases,
		category: 'target',
		family,
		countable: true,
		kind: 'symbol',
		svg: svgFor(id),
		anchor: 'base',
		...extra
	};
}

/** The first set from spec §7.7, drawn in style A. Plan 1 ids are kept so saved plans still open. */
export const ENTRIES: readonly CatalogEntry[] = [
	target('paper', 'Paper target', 'paper', ['IPSC target', 'USPSA target', 'cardboard']),
	target('paper-small', 'Small paper target', 'paper', ['mini IPSC', 'small cardboard']),
	target('paper-hard-cover', 'Paper with hard cover', 'paper', ['hard cover', 'partial target'], {
		plural: 'Papers with hard cover'
	}),
	target('no-shoot', 'No-shoot', 'paper', ['NS', 'no shoot', 'penalty target']),
	target('popper', 'Knock-down popper', 'poppers', ['popper', 'pepper popper']),
	target('popper-static', 'Static popper', 'poppers', []),
	target('popper-trigger', 'Trigger popper', 'poppers', ['activator', 'activator popper']),
	target('popper-auto-reset', 'Auto-reset popper', 'poppers', [
		'auto popper',
		'self-resetting popper'
	]),
	target('steel-static', 'Static steel', 'steel', ['steel plate', 'plate'], {
		plural: 'Static steel'
	}),
	target('plate-kd', 'KD plate', 'steel', ['knock-down plate', 'falling plate'], {
		keepCase: true
	}),
	target('plate-stop', 'Stop plate', 'steel', ['stop target', 'last target']),
	target('plate-rack', 'Plate rack', 'steel', ['row of plates', 'plate bank']),
	target('ducks', 'Ducks in a row', 'steel', ['duck targets', 'ducks'], {
		plural: 'Ducks in a row'
	}),
	target('bottle', 'Bottle', 'steel', ['steel bottle']),
	target('swinger', 'Swinger', 'movers', ['swinging target', 'swinging paper']),
	target('flasher', 'Flasher', 'movers', ['disappearing target', 'bobber']),
	target('spinner', 'Spinner', 'movers', ['spinning target']),
	target('texas-star', 'Texas star', 'movers', ['star'], { keepCase: true }),
	target('whirly-gig', 'Whirly-gig', 'movers', ['whirlygig']),
	{
		id: 'barrel',
		name: 'Barrel',
		aliases: ['drum'],
		category: 'prop',
		countable: false,
		kind: 'symbol',
		svg: svgFor('barrel'),
		anchor: 'center'
	},
	{
		id: 'dump-box',
		name: 'Dump box',
		aliases: [],
		category: 'prop',
		countable: false,
		kind: 'symbol',
		svg: svgFor('dump-box'),
		anchor: 'center',
		autoLabel: { prefix: '', style: 'letter' }
	},
	{
		id: 'shooting-position',
		name: 'Shooting position',
		aliases: ['shooting area', 'SA'],
		category: 'marker',
		countable: false,
		kind: 'symbol',
		svg: svgFor('shooting-position'),
		anchor: 'center',
		autoLabel: { prefix: 'SA-', style: 'number' }
	},
	{
		id: 'wall',
		name: 'Wall',
		aliases: [],
		category: 'structure',
		countable: false,
		kind: 'footprint',
		footprint: { style: 'solid', widthFt: 8, depthFt: 0.5 }
	},
	{
		id: 'shooting-box',
		name: 'Shooting box',
		aliases: [],
		category: 'area',
		countable: false,
		kind: 'footprint',
		footprint: { style: 'outline', widthFt: 4, depthFt: 4 }
	},
	{
		id: 'start-box',
		name: 'Start box',
		aliases: [],
		category: 'area',
		countable: false,
		kind: 'footprint',
		footprint: { style: 'outline', widthFt: 3, depthFt: 3 }
	},
	{
		id: 'fault-line',
		name: 'Fault line',
		aliases: [],
		category: 'area',
		countable: false,
		kind: 'footprint',
		footprint: { style: 'line', widthFt: 8, depthFt: 0.25 }
	}
];
