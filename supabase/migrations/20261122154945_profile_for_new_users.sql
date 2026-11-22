-- Every new auth user (invited or created by an admin) gets a profile with the md role.
-- The function lives in a schema the Data API doesn't expose, and nobody may call it directly;
-- the trigger runs it as its owner.
CREATE SCHEMA IF NOT EXISTS private;--> statement-breakpoint

CREATE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.profiles (id, display_name)
	VALUES (
		new.id,
		coalesce(
			nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
			split_part(new.email, '@', 1)
		)
	);
	RETURN new;
END;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();--> statement-breakpoint

-- The Data API may read a user's own profile (RLS limits it to their row) and write nothing.
-- The server reads and writes profiles through Drizzle.
REVOKE ALL ON public.profiles FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.profiles TO authenticated;
