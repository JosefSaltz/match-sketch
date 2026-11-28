import { tick } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { getDb } from '#lib/store/index.js';
import { PANEL_INSPECTOR_SETTING, PANEL_SYMBOLS_SETTING, setSetting } from '#lib/store/settings.js';
import { nextDrawer, panelSettingValue, WIDE_QUERY, type Panel } from './panels.js';

/**
 * Which editor panels are showing. One state serves both layouts so a panel is rendered once:
 * on a wide screen Symbols and Inspector collapse (remembered per device); on a narrow one every
 * panel is a drawer, only one at a time, and always starts closed.
 */
class Panels {
	/** True at `lg` and up (the server fallback is wide, so the app never renders a drawer first). */
	readonly #wide = new MediaQuery(WIDE_QUERY, true);
	/** Wide-screen open state, loaded with the app (see +layout.ts). */
	desktopSymbols = $state(true);
	desktopInspector = $state(true);
	/** The drawer open on a narrow screen, if any. */
	drawer = $state<Panel | null>(null);

	get wide(): boolean {
		return this.#wide.current;
	}

	isOpen(panel: Panel): boolean {
		if (this.wide) {
			if (panel === 'symbols') return this.desktopSymbols;
			if (panel === 'inspector') return this.desktopInspector;
			return false;
		}
		return this.drawer === panel;
	}

	/** Opens a panel and moves focus to its close button, so keyboard users land inside it. */
	open(panel: Panel): void {
		if (this.wide) {
			if (panel === 'menu') return; // The toolbar is always in the bar on a wide screen.
			this.#setDesktop(panel, true);
		} else {
			this.drawer = nextDrawer(this.drawer, panel, true);
		}
		focusAfterRender(`[data-panel-close="${panel}"]`);
	}

	/**
	 * Closes a panel. `restoreFocus` returns focus to the control that opens it; skip it when the
	 * user is heading elsewhere (e.g. to the stage after arming a symbol).
	 */
	close(panel: Panel, restoreFocus = true): void {
		if (this.wide) {
			if (panel === 'menu') return;
			this.#setDesktop(panel, false);
		} else {
			this.drawer = nextDrawer(this.drawer, panel, false);
		}
		if (restoreFocus) focusAfterRender(`[data-panel-open="${panel}"]`);
	}

	toggle(panel: Panel): void {
		if (this.isOpen(panel)) this.close(panel);
		else this.open(panel);
	}

	/** Closes whichever drawer is open (narrow screens only). */
	closeDrawer(restoreFocus = true): void {
		if (!this.wide && this.drawer) this.close(this.drawer, restoreFocus);
	}

	/** Back to the starting state for a fresh editor: no drawer open. */
	reset(): void {
		this.drawer = null;
	}

	#setDesktop(panel: 'symbols' | 'inspector', open: boolean): void {
		if (panel === 'symbols') this.desktopSymbols = open;
		else this.desktopInspector = open;
		setSetting(
			getDb(),
			panel === 'symbols' ? PANEL_SYMBOLS_SETTING : PANEL_INSPECTOR_SETTING,
			panelSettingValue(open)
		).catch(console.error);
	}
}

/** Focuses an element once the panel state has reached the DOM (inert lifted, buttons swapped). */
function focusAfterRender(selector: string): void {
	void tick().then(() =>
		document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
	);
}

export const panels = new Panels();
