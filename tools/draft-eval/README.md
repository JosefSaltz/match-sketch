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
ANTHROPIC_API_KEY=sk-ant-… EVAL_EFFORT=medium pnpm eval:draft
```

Each run prints a table and writes `tools/draft-eval/out/<time>-<effort>.json` (git-ignored) with
every draft, for a closer look.

## Results

No runs yet. The service uses `medium` effort (`DRAFT_EFFORT` in
`src/lib/server/draft/handle.ts`) until an eval run says otherwise.
