export type DraftUsage = {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
};

/** US dollars per million tokens. A fallback model may answer a declined request. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
	'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
	'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
	'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 }
};
/** An unknown model is priced at the highest known rates, so the ceiling errs on the safe side. */
const HIGHEST = {
	input: Math.max(...Object.values(PRICES).map((p) => p.input)),
	output: Math.max(...Object.values(PRICES).map((p) => p.output)),
	cacheRead: Math.max(...Object.values(PRICES).map((p) => p.cacheRead))
};

/** Estimated cost of a draft's model calls; cache writes cost 1.25× input. */
export function estimateCostUsd(model: string, usage: DraftUsage): number {
	const price = PRICES[model] ?? HIGHEST;
	return (
		(usage.inputTokens * price.input +
			usage.cacheWriteTokens * price.input * 1.25 +
			usage.cacheReadTokens * price.cacheRead +
			usage.outputTokens * price.output) /
		1_000_000
	);
}
