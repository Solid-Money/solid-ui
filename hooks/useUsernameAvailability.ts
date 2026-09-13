import { useEffect, useState } from 'react';

import { checkUsernameAvailability } from '@/lib/api';
import { getUsernameFormatError, normalizeUsername } from '@/lib/utils/username';

// Long enough that a typed-out name is checked once rather than per keystroke.
const AVAILABILITY_DEBOUNCE_MS = 400;

/** Shown when the server refuses a handle without saying why. */
export const USERNAME_TAKEN_FALLBACK = 'This username is already taken';

export type UsernameAvailability =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; reason: string };

/**
 * Whether the handle being typed is free, checked once typing settles so the
 * answer is on screen before the user reaches for the button.
 *
 * Shared by the onboarding step and the rename screen in settings. Only the
 * server knows the reserved list and who already holds a name, so this is the
 * only way either form can report either — but it is advisory: an unreachable
 * check reports `idle` rather than blocking, because the request that actually
 * claims the name validates it again and is the real gate.
 *
 * `skip` is for a value that must not be asked about at all — the caller's own
 * current handle, which the public endpoint would answer "taken" for.
 */
export const useUsernameAvailability = (
  value: string,
  { skip = false }: { skip?: boolean } = {},
): UsernameAvailability => {
  const [availability, setAvailability] = useState<UsernameAvailability>({ status: 'idle' });

  useEffect(() => {
    if (skip || getUsernameFormatError(value)) {
      setAvailability({ status: 'idle' });
      return;
    }

    const candidate = normalizeUsername(value);
    setAvailability({ status: 'checking' });

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(candidate);
        if (cancelled) return;
        setAvailability(
          result.available
            ? { status: 'available' }
            : { status: 'unavailable', reason: result.reason || USERNAME_TAKEN_FALLBACK },
        );
      } catch {
        if (!cancelled) setAvailability({ status: 'idle' });
      }
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, skip]);

  return availability;
};
