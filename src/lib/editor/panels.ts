/** The editor's side panels. On a wide screen two of them collapse; on a narrow one all three are drawers. */
export type Panel = 'symbols' | 'inspector' | 'menu';

/** The breakpoint (Tailwind `lg`) at which the editor switches from drawers to columns. */
export const WIDE_QUERY = 'min-width: 1024px';

/** The DOM id of a panel's container, for `aria-controls`. */
export function panelDomId(panel: Panel): string {
	return `editor-panel-${panel}`;
}

/** A saved panel choice (settings store); anything but 'closed' means open. */
export function parsePanelSetting(value: string | undefined): boolean {
	return value !== 'closed';
}

/** The setting value that remembers a panel's desktop state. */
export function panelSettingValue(open: boolean): 'open' | 'closed' {
	return open ? 'open' : 'closed';
}

/**
 * The drawer open after `panel` is opened or closed. Only one drawer shows at a time, so opening
 * one replaces any other; closing a drawer that isn't the open one changes nothing.
 */
export function nextDrawer(current: Panel | null, panel: Panel, open: boolean): Panel | null {
	if (open) return panel;
	return current === panel ? null : current;
}
