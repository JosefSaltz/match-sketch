import type { CatalogEntry, SymbolFamily } from './types';
import paperSvg from './svg/paper.svg?raw';
import popperSvg from './svg/popper.svg?raw';
import popperStaticSvg from './svg/popper-static.svg?raw';
import popperTriggerSvg from './svg/popper-trigger.svg?raw';
import popperAutoResetSvg from './svg/popper-auto-reset.svg?raw';
import steelStaticSvg from './svg/steel-static.svg?raw';
import barrelSvg from './svg/barrel.svg?raw';
import dumpBoxSvg from './svg/dump-box.svg?raw';
import shootingPositionSvg from './svg/shooting-position.svg?raw';

/** Families used by the entries below. Plan 3 adds the rest (paper, plates, movers…). */
export const FAMILIES: Readonly<Record<string, SymbolFamily>> = {
	poppers: { id: 'poppers', name: 'Poppers' }
};

/** Placeholder set for Plan 1. Plan 3 redraws the art and keeps these ids. */
export const ENTRIES: readonly CatalogEntry[] = [
	{
		id: 'paper',
		name: 'Paper target',
		aliases: [],
		category: 'target',
		countable: true,
		kind: 'symbol',
		svg: paperSvg,
		anchor: 'base'
	},
	{
		id: 'popper',
		name: 'Knock-down popper',
		aliases: ['popper', 'pepper popper'],
		category: 'target',
		family: 'poppers',
		countable: true,
		kind: 'symbol',
		svg: popperSvg,
		anchor: 'base'
	},
	{
		id: 'popper-static',
		name: 'Static popper',
		aliases: [],
		category: 'target',
		family: 'poppers',
		countable: true,
		kind: 'symbol',
		svg: popperStaticSvg,
		anchor: 'base'
	},
	{
		id: 'popper-trigger',
		name: 'Trigger popper',
		aliases: ['activator', 'activator popper'],
		category: 'target',
		family: 'poppers',
		countable: true,
		kind: 'symbol',
		svg: popperTriggerSvg,
		anchor: 'base'
	},
	{
		id: 'popper-auto-reset',
		name: 'Auto-reset popper',
		aliases: ['auto popper', 'self-resetting popper'],
		category: 'target',
		family: 'poppers',
		countable: true,
		kind: 'symbol',
		svg: popperAutoResetSvg,
		anchor: 'base'
	},
	{
		id: 'steel-static',
		name: 'Static steel',
		aliases: ['steel plate', 'plate'],
		category: 'target',
		countable: true,
		kind: 'symbol',
		svg: steelStaticSvg,
		anchor: 'base'
	},
	{
		id: 'barrel',
		name: 'Barrel',
		aliases: ['drum'],
		category: 'prop',
		countable: false,
		kind: 'symbol',
		svg: barrelSvg,
		anchor: 'center'
	},
	{
		id: 'dump-box',
		name: 'Dump box',
		aliases: [],
		category: 'prop',
		countable: false,
		kind: 'symbol',
		svg: dumpBoxSvg,
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
		svg: shootingPositionSvg,
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
