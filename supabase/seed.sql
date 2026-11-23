-- Local dev only: `supabase start` on a fresh database and `supabase db reset` load this after
-- the migrations. Remote databases never run it.
--
-- A confirmed admin account to sign in with: josef@match-sketch.test / password123.
-- The profile trigger (private.handle_new_user) creates its profile; the role is set after.

INSERT INTO auth.users (
	instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
	raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
	-- GoTrue reads these as strings and fails on NULL.
	confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES (
	'00000000-0000-0000-0000-000000000000',
	'00000000-0000-4000-8000-00000000d001',
	'authenticated',
	'authenticated',
	'josef@match-sketch.test',
	extensions.crypt('password123', extensions.gen_salt('bf')),
	now(),
	'{"provider": "email", "providers": ["email"]}',
	'{"display_name": "Josef"}',
	now(),
	now(),
	'', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
	id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES (
	'00000000-0000-4000-8000-00000000d001',
	'00000000-0000-4000-8000-00000000d001',
	'00000000-0000-4000-8000-00000000d001',
	'email',
	'{"sub": "00000000-0000-4000-8000-00000000d001", "email": "josef@match-sketch.test", "email_verified": true}',
	now(),
	now(),
	now()
) ON CONFLICT DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000d001';
