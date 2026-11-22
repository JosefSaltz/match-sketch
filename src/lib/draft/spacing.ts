import type { SymbolSize } from '../model/plan';
import { PRINT_SYMBOL_PX } from '../print/page';

/**
 * Roughly layout B's portrait diagram (spec §9) with a short procedure: the area a whole bay is
 * fitted into when printed. Laying out the real page needs text measuring, which the server
 * doesn't have; the draft only needs the scale.
 */
const FIT_AREA_PX = { width: 730, height: 600 };

/**
 * The closest two fixed-size symbols may stand without overlapping when the plan prints fit to
 * page: one printed symbol width, in feet, rounded up to half a foot (spec §7.5).
 */
export function minSpacingFt(
	canvas: { widthFt: number; depthFt: number },
	symbolSize: SymbolSize
): number {
	const pxPerFt = Math.min(FIT_AREA_PX.width / canvas.widthFt, FIT_AREA_PX.height / canvas.depthFt);
	return Math.ceil((PRINT_SYMBOL_PX[symbolSize] / pxPerFt) * 2) / 2;
}
