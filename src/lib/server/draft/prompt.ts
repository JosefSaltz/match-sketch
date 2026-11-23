import type Anthropic from '@anthropic-ai/sdk';
import { CATALOG, FAMILIES } from '../../catalog';
import type { DraftRequest } from '../../draft/contract';
import { minSpacingFt } from '../../draft/spacing';

const INSTRUCTIONS = `You lay out practical shooting stages (multigun, pistol, rifle) for match directors.

You get a bay (a rectangle measured in feet), a stage brief and a description, and you place symbols from the catalog below to draw a schematic of the stage. The match director reviews and corrects your draft by hand, so aim for a sensible, readable layout, as an experienced match director would sketch it; nobody expects the exact real positions.

Coordinates: feet, origin at the uprange-left corner of the bay. x runs from the left edge (0) to the right edge (the bay width). y runs downrange from the uprange edge (0, where shooters start) to the far edge (the bay depth).
- A footprint's x, y is its centre; widthFt runs across the bay and depthFt downrange at rotation 0, and the whole footprint must fit inside the bay.
- A target's or prop's x, y is where it stands. They are drawn upright, facing the shooter, so leave them at rotation 0.
- Rotation (degrees clockwise) is for footprints: a wall at an angle, a fault line along a diagonal.
- Labels are at most 24 characters.

Layout conventions:
- The start position sits near the uprange edge.
- Shooting areas (SA-1, SA-2, …), shooting boxes, walls and props the shooter uses are uprange; the targets each one engages are downrange of it.
- Follow the order of the procedure: SA-1 first, then SA-2, and so on, usually across or downrange.
- Label things the procedure names: SA-1…SA-n on shooting areas, letters (A, B) on dump boxes, so the drawing matches the text. Write each label exactly as the procedure writes it ("SA-4", not "SA-4 Rooftop"; "B", not "B (SA-5)"), and leave everything else unlabelled: the symbol already shows what a target or prop is.
- For a row of identical targets, place one target symbol with a count (for example 4 static steel as one object with count 4) instead of many separate symbols.
- Keep fixed-size symbols (targets and small props) apart by at least the minimum spacing given, so they don't overlap when printed.
- Footprints (walls, boxes, fault lines, vehicles, platforms…) are drawn to scale: give widthFt and depthFt, or null to use the catalog size.
- Everything must lie inside the bay.

Use only catalog symbol ids. If something in the description can't be drawn with the catalog, leave it out of the placements and list it, in a few words, under unrepresentable.`;

function catalogLines(): string {
	return CATALOG.map((e) =>
		JSON.stringify({
			id: e.id,
			name: e.name,
			aliases: e.aliases,
			category: e.category,
			...(e.family && { family: FAMILIES[e.family]?.name ?? e.family }),
			kind: e.kind,
			size:
				e.kind === 'footprint'
					? `${e.footprint.widthFt} × ${e.footprint.depthFt} ft (to scale)`
					: 'fixed print size',
			...(e.countable && { count: 'allowed' })
		})
	).join('\n');
}

/**
 * The draft request for Claude (spec §7.5 step 2). The instructions and catalog never change
 * between requests, so they lead and are cached; the bay, brief and description follow.
 */
export function buildDraftPrompt(request: DraftRequest): {
	system: Anthropic.Beta.BetaTextBlockParam[];
	messages: Anthropic.Beta.BetaMessageParam[];
} {
	const { canvas, brief } = request;
	const spacing = minSpacingFt(canvas, request.symbolSize);
	const unit = canvas.unit === 'yd' ? 'yd' : 'ft';
	const inUnit = (ft: number) => (canvas.unit === 'yd' ? `${+(ft / 3).toFixed(1)} yd` : `${ft} ft`);
	const fields = [
		['Stage name', brief.stageName],
		['Start position', brief.startPosition],
		['Gun ready condition', brief.gunReady],
		['Round count', brief.roundCount],
		['Targets', brief.targetsOverride ?? ''],
		['Par time', brief.parTime],
		...brief.notes.map((n) => [n.title || 'Notes', n.body])
	]
		.filter(([, v]) => v.trim())
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');
	const user = `Bay: ${canvas.widthFt} ft wide × ${canvas.depthFt} ft deep (${inUnit(canvas.widthFt)} × ${inUnit(canvas.depthFt)}; the match director works in ${unit}).
Minimum spacing: keep fixed-size symbols at least ${spacing} ft apart.

Stage brief:
${fields || '(no other fields filled in)'}

Description to draw:
${request.description}`;
	return {
		system: [
			{ type: 'text', text: INSTRUCTIONS },
			{
				type: 'text',
				text: `Catalog (one symbol per line):\n${catalogLines()}`,
				cache_control: { type: 'ephemeral' }
			}
		],
		messages: [{ role: 'user', content: user }]
	};
}
