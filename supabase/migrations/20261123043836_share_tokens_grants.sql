-- Share tokens are server-only (Drizzle); the Data API gets nothing. RLS stays on as a backstop.
REVOKE ALL ON public.share_tokens FROM anon, authenticated;
