-- Draft logs are server-only (Drizzle); the Data API gets nothing. RLS stays on as a backstop.
REVOKE ALL ON public.ai_drafts FROM anon, authenticated;
