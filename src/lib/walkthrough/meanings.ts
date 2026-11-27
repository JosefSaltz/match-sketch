import { MEANINGS, type Mark, type Meaning } from '../model/plan';

export type MeaningStyle = {
	label: string;
	/** The ring and badge color. */
	color: string;
	/** The glyph's color on the badge. */
	ink: string;
	/** The badge glyph in a 24 × 24 box: stroked unless `filled`. */
	glyph: { d: string; filled: boolean };
};

/**
 * What each walkthrough meaning looks like (spec §7.10). The badge shape carries the meaning on
 * its own, so highlights read in black and white and for colorblind viewers.
 */
export const MEANING_STYLES: Record<Meaning, MeaningStyle> = {
	start: {
		label: 'Start',
		color: '#2e7d32',
		ink: '#fff',
		glyph: { d: 'M7 21V4 M7 5h10l-3 3.5 3 3.5H7', filled: false }
	},
	move: {
		label: 'Move',
		color: '#1565c0',
		ink: '#fff',
		glyph: { d: 'M4 12h14 M12 6l6 6-6 6', filled: false }
	},
	shoot: {
		label: 'Shoot',
		color: '#d84315',
		ink: '#fff',
		glyph: {
			d: 'M12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11 M12 2.5v5 M12 16.5v5 M2.5 12h5 M16.5 12h5',
			filled: false
		}
	},
	activate: {
		label: 'Activate',
		color: '#f9a825',
		ink: '#1c1c1a',
		glyph: { d: 'M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.5z', filled: true }
	},
	avoid: {
		label: 'Avoid',
		color: '#616161',
		ink: '#fff',
		glyph: { d: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M6.3 6.3l11.4 11.4', filled: false }
	}
};

/** The meanings a step uses, in legend order. */
export function meaningsUsed(marks: Mark[]): Meaning[] {
	const used = new Set(marks.map((m) => m.meaning));
	return MEANINGS.filter((m) => used.has(m));
}
