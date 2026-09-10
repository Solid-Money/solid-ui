/**
 * Rules for the handle chosen during onboarding. These mirror the server's
 * format rules (`username-rules.ts` in the accounts service) so the form can
 * answer without a round trip — the server still re-validates, and it alone
 * owns the reserved-name list and uniqueness.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const DISALLOWED_CHARACTERS = /[^a-z0-9._-]/g;

/**
 * What the user typed, as it will be stored: handles are lowercase, so a name
 * typed either way is one name.
 */
export const normalizeUsername = (value: string): string => value.trim().toLowerCase();

/**
 * Keystroke-level cleanup for the input. Lowercases, drops characters a handle
 * cannot contain, and stops at the maximum length, so the field can only ever
 * hold something submittable. Deliberately does not trim: a trailing space
 * would otherwise be eaten mid-word and make the field feel stuck.
 */
export const sanitizeUsernameInput = (value: string): string =>
  value.toLowerCase().replace(DISALLOWED_CHARACTERS, '').slice(0, USERNAME_MAX_LENGTH);

/**
 * The first thing wrong with a handle's shape, or null when the shape is fine.
 * Says nothing about whether it is free — that is the availability check.
 */
export const getUsernameFormatError = (value: string): string | null => {
  const username = normalizeUsername(value);

  if (!username) return 'Please choose a username';
  if (username.length < USERNAME_MIN_LENGTH)
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  if (username.length > USERNAME_MAX_LENGTH)
    return `Username cannot exceed ${USERNAME_MAX_LENGTH} characters`;
  if (!USERNAME_PATTERN.test(username))
    return 'Username can only contain letters, numbers, dots, underscores, and hyphens';

  return null;
};

export const isUsernameFormatValid = (value: string): boolean =>
  getUsernameFormatError(value) === null;

/**
 * Whether a failed signup failed because the handle was claimed in the
 * meantime — as opposed to any other conflict, the registered-email one in
 * particular, which choosing a different handle would not fix.
 */
export const isUsernameTakenError = (error: unknown): boolean => {
  const { status, message } = (error ?? {}) as { status?: number; message?: unknown };

  return status === 409 && typeof message === 'string' && /username/i.test(message);
};

/**
 * A starting point for the field, derived from the address the user just
 * verified — the handle they used to be assigned automatically. Empty when the
 * address has nothing usable in it, so the user is asked rather than given a
 * name they did not choose.
 */
export const suggestUsernameFromEmail = (email: string): string => {
  const prefix = email.split('@')[0] ?? '';
  const suggestion = sanitizeUsernameInput(prefix);

  return suggestion.length >= USERNAME_MIN_LENGTH ? suggestion : '';
};
