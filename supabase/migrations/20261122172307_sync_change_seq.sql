-- Every write to a synced record takes the next change_seq: inserts by the column default,
-- updates by this trigger. Clients pull rows with change_seq above their cursor.
CREATE FUNCTION private.bump_change_seq()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	new.change_seq := nextval('public.sync_change_seq');
	RETURN new;
END;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION private.bump_change_seq() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

CREATE TRIGGER canvases_bump_change_seq BEFORE UPDATE ON public.canvases
	FOR EACH ROW EXECUTE FUNCTION private.bump_change_seq();--> statement-breakpoint
CREATE TRIGGER matches_bump_change_seq BEFORE UPDATE ON public.matches
	FOR EACH ROW EXECUTE FUNCTION private.bump_change_seq();--> statement-breakpoint
CREATE TRIGGER plans_bump_change_seq BEFORE UPDATE ON public.plans
	FOR EACH ROW EXECUTE FUNCTION private.bump_change_seq();--> statement-breakpoint

-- The app syncs through its own endpoints (Drizzle); the Data API gets nothing. RLS and the
-- select-own policies stay as a backstop if a grant is ever added.
REVOKE ALL ON public.canvases, public.matches, public.plans FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON SEQUENCE public.sync_change_seq FROM anon, authenticated;
