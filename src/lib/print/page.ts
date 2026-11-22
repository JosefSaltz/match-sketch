import type { SymbolSize } from '../model/plan';

export type Orientation = 'portrait' | 'landscape';

/** Page units are CSS px: 96 per inch. */
export const PX_PER_IN = 96;

/** US Letter in page px. */
export function pageSize(o: Orientation): { width: number; height: number } {
	return o === 'portrait' ? { width: 816, height: 1056 } : { width: 1056, height: 816 };
}

/** 0.45 in. */
export const MARGIN_PX = 43;

/** Fixed printed symbol sizes: 0.35, 0.45 and 0.55 in. */
export const PRINT_SYMBOL_PX: Record<SymbolSize, number> = {
	small: 33.6,
	medium: 43.2,
	large: 52.8
};
