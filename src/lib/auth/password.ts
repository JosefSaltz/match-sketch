/** Matches `minimum_password_length` in supabase/config.toml (and the hosted project). */
export const MIN_PASSWORD_LENGTH = 8;

/** Why a new password can't be used, or `null` if it can. */
export function checkNewPassword(password: string, confirm: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH)
		return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
	if (password !== confirm) return "The passwords don't match.";
	return null;
}
