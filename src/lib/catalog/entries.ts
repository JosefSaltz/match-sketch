import type { FootprintStyle } from './footprint-shapes';
import type { CatalogEntry, FootprintEntry, SymbolEntry, SymbolFamily } from './types';

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

/** A prop seen from above, drawn at a fixed size about its center. */
function prop(id: string, name: string, aliases: string[]): SymbolEntry {
	return {
		id,
		name,
		aliases,
		category: 'prop',
		countable: false,
		kind: 'symbol',
		svg: svgFor(id),
		anchor: 'center'
	};
}

/** A structure seen from above, drawn to scale (default size in ft). */
function structure(
	id: string,
	name: string,
	style: FootprintStyle,
	widthFt: number,
	depthFt: number,
	aliases: string[]
): FootprintEntry {
	return {
		id,
		name,
		aliases,
		category: 'structure',
		countable: false,
		kind: 'footprint',
		footprint: { style, widthFt, depthFt }
	};
}

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
	prop('barrel', 'Barrel', ['drum', '55 gallon drum']),
	prop('barrels-stacked', 'Stacked barrels', ['barrel stack']),
	prop('tire', 'Tire', ['tyre', 'wheel']),
	prop('chair', 'Chair', ['seat']),
	prop('ammo-can', 'Ammo can', ['ammo box']),
	prop('bucket', 'Bucket', ['pail']),
	prop('crate', 'Crate', ['box', 'wooden box']),
	prop('tree', 'Tree', ['bush']),
	prop('target-stand', 'Target stand', ['target frame', 'stand']),
	prop('sawhorse', 'Sawhorse', ['saw horse']),
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
	structure('wall', 'Wall', 'solid', 8, 0.5, ['partition', 'panel']),
	structure('wall-port', 'Wall with port', 'wall-port', 8, 0.5, [
		'port wall',
		'window wall',
		'wall with window'
	]),
	structure('half-wall-port', 'Half wall with port', 'half-wall-port', 8, 0.5, [
		'low wall',
		'half wall'
	]),
	structure('v-wall', 'V-tac wall', 'v-wall', 6, 3, ['V wall', 'VTAC']),
	structure('door', 'Door', 'door', 3, 3, ['doorway']),
	structure('car', 'Car', 'car', 6, 15, ['vehicle', 'truck']),
	structure('table', 'Table', 'table', 6, 3, ['desk']),
	structure('pallet', 'Pallet', 'pallet', 4, 4, ['skid']),
	structure('chopper-seat', 'Chopper seat', 'bench', 5, 2, ['helicopter seat', 'bench seat']),
	structure('plank', 'Plank', 'bench', 8, 1, ['board', 'balance beam']),
	structure('stairs', 'Staircase', 'stairs', 4, 6, ['stairs', 'steps']),
	structure('platform', 'Platform', 'platform', 8, 8, ['rooftop', 'raised platform']),
	structure('wobble', 'Wobble platform', 'wobble', 4, 4, ['wobble board', 'unstable platform']),
	structure('barrier', 'Low barrier', 'barrier', 6, 0.5, ['sticks', 'low port']),
	structure('berm', 'Berm', 'berm', 20, 6, ['mound', 'dirt pile']),
	structure('fence', 'Fence', 'fence', 10, 0.3, ['mesh', 'snow fence']),
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
		footprint: { style: 'start-box', widthFt: 3, depthFt: 3 }
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
