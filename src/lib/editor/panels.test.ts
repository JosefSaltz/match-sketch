import { describe, expect, it } from 'vitest';
import { nextDrawer, panelDomId, panelSettingValue, parsePanelSetting } from './panels';

describe('parsePanelSetting', () => {
	it('defaults to open', () => {
		expect(parsePanelSetting(undefined)).toBe(true);
		expect(parsePanelSetting('open')).toBe(true);
		expect(parsePanelSetting('nonsense')).toBe(true);
	});

	it('reads closed', () => {
		expect(parsePanelSetting('closed')).toBe(false);
	});

	it('round-trips through panelSettingValue', () => {
		expect(parsePanelSetting(panelSettingValue(true))).toBe(true);
		expect(parsePanelSetting(panelSettingValue(false))).toBe(false);
	});
});

describe('nextDrawer', () => {
	it('opens a drawer from nothing', () => {
		expect(nextDrawer(null, 'symbols', true)).toBe('symbols');
	});

	it('closes the others when one opens', () => {
		expect(nextDrawer('symbols', 'inspector', true)).toBe('inspector');
		expect(nextDrawer('inspector', 'menu', true)).toBe('menu');
	});

	it('closes the open drawer', () => {
		expect(nextDrawer('menu', 'menu', false)).toBeNull();
	});

	it('ignores closing a drawer that is not open', () => {
		expect(nextDrawer('inspector', 'symbols', false)).toBe('inspector');
		expect(nextDrawer(null, 'menu', false)).toBeNull();
	});
});

describe('panelDomId', () => {
	it('is distinct per panel', () => {
		expect(new Set(['symbols', 'inspector', 'menu'].map((p) => panelDomId(p as never))).size).toBe(
			3
		);
	});
});
