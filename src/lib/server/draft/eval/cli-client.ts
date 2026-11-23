/**
 * Eval only: a DraftClient that sends the service's requests through the local `claude` CLI
 * (headless, no tools, no settings or MCP), so the eval can run on a Claude subscription
 * instead of an API key. Same model, effort, system prompt, catalog and output schema as the
 * API path; it does not exercise the API's server-side fallback or the streaming adapter.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { DraftOutputSchema } from '../../../draft/contract';
import type { DraftClient } from '../service';

type CliResult = {
	is_error: boolean;
	result: string;
	structured_output?: unknown;
	stop_reason?: string;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cache_read_input_tokens?: number;
		cache_creation_input_tokens?: number;
	};
};

const textOf = (content: Anthropic.Beta.BetaMessageParam['content'] | undefined): string =>
	typeof content === 'string'
		? content
		: (content ?? [])
				.map((b) => ('text' in b && typeof b.text === 'string' ? b.text : ''))
				.join('');

/** One prompt from the conversation: the request, then (on the repair round) the draft and the problems. */
function prompt(messages: Anthropic.Beta.BetaMessageParam[]): string {
	const [first, previous, repair] = messages;
	let text = textOf(first?.content);
	if (previous && repair) {
		text += `\n\nYour previous draft was:\n${textOf(previous.content)}\n\n${textOf(repair.content)}`;
	}
	return text;
}

export function claudeCliDraftClient(): DraftClient {
	// The CLI's validator doesn't resolve the `$schema` meta-schema URL; the rest is plain JSON Schema.
	const { $schema: _meta, ...jsonSchema } = z.toJSONSchema(DraftOutputSchema);
	void _meta;
	const schema = JSON.stringify(jsonSchema);
	return {
		async send(params, { signal }) {
			const dir = mkdtempSync(join(tmpdir(), 'draft-eval-'));
			const systemFile = join(dir, 'system.txt');
			const system = Array.isArray(params.system)
				? params.system.map((b) => b.text).join('\n\n')
				: (params.system ?? '');
			writeFileSync(systemFile, system);
			const effort = params.output_config?.effort ?? 'medium';
			try {
				const stdout = await new Promise<string>((resolve, reject) => {
					const child = execFile(
						'claude',
						[
							'-p',
							prompt(params.messages),
							'--model',
							params.model,
							'--effort',
							effort,
							'--output-format',
							'json',
							'--json-schema',
							schema,
							'--system-prompt-file',
							systemFile,
							'--tools',
							'',
							'--strict-mcp-config',
							'--setting-sources',
							'',
							'--no-session-persistence'
						],
						{ signal, maxBuffer: 64 * 1024 * 1024, cwd: dir },
						(error, out) => (error ? reject(new Error(error.message)) : resolve(out))
					);
					// The prompt is an argument; close stdin so the CLI doesn't wait for piped input.
					child.stdin?.end();
				});
				const result = JSON.parse(stdout) as CliResult;
				if (result.is_error) throw new Error(result.result || 'claude CLI error');
				return {
					model: params.model,
					stop_reason: result.structured_output ? 'end_turn' : (result.stop_reason ?? 'end_turn'),
					content: [
						{
							type: 'text',
							text: result.structured_output
								? JSON.stringify(result.structured_output)
								: result.result
						}
					],
					usage: {
						input_tokens: result.usage?.input_tokens ?? 0,
						output_tokens: result.usage?.output_tokens ?? 0,
						cache_read_input_tokens: result.usage?.cache_read_input_tokens ?? 0,
						cache_creation_input_tokens: result.usage?.cache_creation_input_tokens ?? 0
					}
				} as unknown as Anthropic.Beta.BetaMessage;
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	};
}
