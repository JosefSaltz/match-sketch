# Draft from text eval

Runs Draft from text (spec §7.5) on the seven reference stages from the MD's deck and grades each
draft. The cases and the grader live in `src/lib/server/draft/eval/`.

The grader scores six checks, each worth 1, and the score is their mean:

1. The stage's target types are present.
2. The counts are within one of the TARGETS line.
3. The SA and dump-box labels from the procedure are present.
4. The targets sit downrange of the shooting areas.
5. Nothing was dropped off the bay.
6. No fixed-size symbols overlap at the fit-to-page print scale.

Bay sizes are guesses until the MD supplies the real DRRC bays.

**It calls the real model and costs money** (roughly $0.05–$0.30 per stage at `medium`, so a run
is about $1–2). Run it only on purpose, never in CI:

```sh
RUN_DRAFT_EVAL=1 ANTHROPIC_API_KEY=sk-ant-… EVAL_EFFORT=medium pnpm eval:draft
```

Each run prints a table and writes `tools/draft-eval/out/<time>-<effort>.json` (git-ignored) with
every draft, for a closer look. It uses the production client (streaming, one retry, the
service's 4-minute deadline), so the seconds it reports are what MDs will wait.

To run it on a Claude subscription instead of an API key, add `DRAFT_EVAL_CLIENT=cli`. The same
prompt, schema, model and effort then go through the local `claude` CLI (headless, no tools).
This path doesn't exercise the API's server-side fallback or the SDK streaming adapter.

```sh
RUN_DRAFT_EVAL=1 DRAFT_EVAL_CLIENT=cli EVAL_EFFORT=medium pnpm eval:draft
```

## Results

**2026-11-22, through the CLI, Claude Opus 5.5:**

| Effort | Mean score | Slowest draft | List-price cost for 7 stages |
| ------ | ---------- | ------------- | ---------------------------- |
| medium | 1.00       | 28 s          | $0.41                        |
| high   | 1.00       | 30 s          | $0.36                        |

- **Before the label fix:** an earlier `medium` run scored 0.98. Claude added words to the
  labels ("SA-4 Rooftop", "B (SA-5)") and labelled targets the procedure doesn't name. The prompt
  now asks for labels exactly as the procedure writes them.
- **Effort:** both levels are perfect on these checks, at the same speed and cost, so the
  service stays at `medium` (`DRAFT_EFFORT` in `src/lib/server/draft/handle.ts`).
- **What the checks can't see:** the grader is saturated. Layout quality beyond its checks
  (sensible spacing, how readable a draft is) needs a person looking at the drafts in
  `tools/draft-eval/out/`.
