import { describe, expect, it } from 'vitest';
import { applyTheme, type ThemeRoot } from './apply';
import { getTheme, type Theme } from './themes';

function fakeRoot() {
	const props: Record<string, string> = {};
	const root: ThemeRoot = {
		dataset: {},
		style: { setProperty: (name, value) => void (props[name] = value) }
	};
	return { root, props };
}

describe('applyTheme', () => {
	it('writes the theme id and variables', () => {
		const { root, props } = fakeRoot();
		applyTheme(getTheme('ranger-green'), root);
		expect(root.dataset.theme).toBe('ranger-green');
		expect(props['--theme-base']).toBe('#4a5240');
		expect(props['--theme-accent']).toBe('#4a5240');
		expect(props['--theme-tile']).toBe('none');
		expect(props['--theme-tile-size']).toBe('auto');
	});

	it('writes a tile and its display size', () => {
		const { root, props } = fakeRoot();
		const camo: Theme = {
			id: 'x',
			name: 'X',
			family: 'camo',
			base: '#112233',
			accent: '#445566',
			tile: { src: '/themes/x.webp', width: 1500, height: 454 }
		};
		applyTheme(camo, root);
		expect(props['--theme-tile']).toBe('url("/themes/x.webp")');
		expect(props['--theme-tile-size']).toBe('1500px 454px');
	});
});
