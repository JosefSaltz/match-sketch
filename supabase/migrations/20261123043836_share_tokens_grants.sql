-- Share tokens are server-only (Drizzle); the Data API gets nothing. RLS stays on as a backstop.
REVOKE ALL ON public.share_tokens FROM anon, authenticated;
--> statement-breakpoint
-- Tokens already on records belong to their owners (none exist before this ships, but a
-- partly applied rollout must not leave one claimable by another account).
INSERT INTO public.share_tokens (token, owner_id)
SELECT share_id, owner_id FROM public.plans WHERE share_id IS NOT NULL
UNION
SELECT share_id, owner_id FROM public.matches WHERE share_id IS NOT NULL
ON CONFLICT DO NOTHING;
