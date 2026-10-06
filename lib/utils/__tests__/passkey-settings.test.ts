import {
  buildPasskeyAccountName,
  buildSettingsPasskeyName,
  describePasskeyActivity,
  formatPasskeyDate,
  isSameCredentialSet,
  isValidTurnkeyPasskeyName,
} from '@/lib/utils/passkey';

/**
 * Settings → Security → Passkeys adds passkeys to the account and describes the
 * ones already there. Turnkey refuses a name it does not like before the
 * system prompt ever shows, so the names are pinned here; the descriptions are
 * what the user reads to tell their passkeys apart.
 */
describe('passkey names for Settings', () => {
  it('gives Turnkey a name it accepts and has not seen before', () => {
    const first = buildSettingsPasskeyName(new Date('2026-10-06T09:00:00.000Z'));
    const second = buildSettingsPasskeyName(new Date('2026-10-06T09:00:00.001Z'));

    expect(isValidTurnkeyPasskeyName(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('files the passkey under the email, as signup does', () => {
    const name = buildPasskeyAccountName({ email: 'Eli@Fuse.io', username: 'eli' });

    expect(name).toBe('elifuse.io');
    expect(isValidTurnkeyPasskeyName(name)).toBe(true);
  });

  it('falls back to the username for accounts without an email', () => {
    expect(buildPasskeyAccountName({ username: 'eli_m' })).toBe('eli_m');
  });

  it('never hands Turnkey an empty name', () => {
    expect(buildPasskeyAccountName({ email: '@@@', username: '' })).toBe('solid');
  });

  it('names the device, so the system picker can tell passkeys apart', () => {
    const name = buildPasskeyAccountName({ email: 'eli@fuse.io', deviceLabel: 'iPhone 15' });

    expect(name).toBe('elifuse.io - iPhone 15');
    expect(isValidTurnkeyPasskeyName(name)).toBe(true);
  });

  it('drops characters Turnkey refuses from the device', () => {
    const name = buildPasskeyAccountName({ email: 'eli@fuse.io', deviceLabel: 'Galaxy S24+ (5G)' });

    expect(name).toBe('elifuse.io - Galaxy S24 5G');
    expect(isValidTurnkeyPasskeyName(name)).toBe(true);
  });

  it('shortens the account, not the device, to stay within 64 characters', () => {
    const name = buildPasskeyAccountName({
      email: `${'a'.repeat(60)}@fuse.io`,
      deviceLabel: 'Chrome on Windows',
    });

    expect(name).toHaveLength(64);
    expect(name.endsWith(' - Chrome on Windows')).toBe(true);
    expect(isValidTurnkeyPasskeyName(name)).toBe(true);
  });

  it('falls back to the account alone when the device has no usable name', () => {
    expect(buildPasskeyAccountName({ email: 'eli@fuse.io', deviceLabel: '✨' })).toBe('elifuse.io');
  });
});

describe('isSameCredentialSet', () => {
  it('ignores order, which would otherwise re-mount the app for nothing', () => {
    expect(isSameCredentialSet(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('notices an added or removed credential', () => {
    expect(isSameCredentialSet(['a'], ['a', 'b'])).toBe(false);
    expect(isSameCredentialSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});

describe('formatPasskeyDate', () => {
  const now = new Date(2026, 9, 6, 15, 0);

  it('says today and yesterday in the local calendar', () => {
    expect(formatPasskeyDate(new Date(2026, 9, 6, 0, 5).toISOString(), now)).toBe('today');
    expect(formatPasskeyDate(new Date(2026, 9, 5, 23, 55).toISOString(), now)).toBe('yesterday');
  });

  it('drops the year inside the current one', () => {
    expect(formatPasskeyDate(new Date(2026, 2, 12).toISOString(), now)).toBe('12 Mar');
  });

  it('keeps the year outside it', () => {
    expect(formatPasskeyDate(new Date(2025, 2, 12).toISOString(), now)).toBe('12 Mar 2025');
  });

  it('returns null for a timestamp that does not parse', () => {
    expect(formatPasskeyDate('not a date', now)).toBeNull();
  });
});

describe('describePasskeyActivity', () => {
  const now = new Date(2026, 9, 6, 15, 0);
  const passkey = {
    createdAt: new Date(2025, 2, 12).toISOString(),
    lastSignInAt: new Date(2026, 9, 6, 9, 0).toISOString(),
  };

  it('keeps the list row to where it is and when it last signed in', () => {
    expect(describePasskeyActivity(passkey, { isThisDevice: true, now })).toBe(
      'This device · Signed in today',
    );
  });

  it('shows when it was added until it has signed in', () => {
    expect(
      describePasskeyActivity({ ...passkey, lastSignInAt: null }, { isThisDevice: false, now }),
    ).toBe('Added 12 Mar 2025');
  });

  it('gives the sheet everything', () => {
    expect(describePasskeyActivity(passkey, { isThisDevice: true, detailed: true, now })).toBe(
      'This device · Added 12 Mar 2025 · Last signed in today',
    );
  });

  it('is empty when there is nothing to say', () => {
    expect(
      describePasskeyActivity(
        { createdAt: null, lastSignInAt: null },
        { isThisDevice: false, now },
      ),
    ).toBe('');
  });
});
