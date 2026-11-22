import type { CatalogEntry } from './types';
import paperSvg from './svg/paper.svg?raw';
import popperSvg from './svg/popper.svg?raw';
import steelStaticSvg from './svg/steel-static.svg?raw';
import barrelSvg from './svg/barrel.svg?raw';
import dumpBoxSvg from './svg/dump-box.svg?raw';
import shootingPositionSvg from './svg/shooting-position.svg?raw';

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
		name: 'Popper',
		aliases: ['pepper popper'],
		category: 'target',
		countable: true,
		kind: 'symbol',
		svg: popperSvg,
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
