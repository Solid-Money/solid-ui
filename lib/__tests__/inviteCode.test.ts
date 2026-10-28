import {
  buildInviteLink,
  buildPlayStoreInviteUrl,
  inviteClipboardText,
  inviteLinkLabel,
  normalizeReferralCode,
  parseInstallReferrer,
  parseInviteCodeFromText,
  referralCodeFromParams,
} from '@/lib/referral/inviteCode';

describe('normalizeReferralCode', () => {
  it('upper-cases and trims a code', () => {
    expect(normalizeReferralCode(' ab12c ')).toBe('AB12C');
  });

  it('rejects anything outside 4–12 letters and digits', () => {
    expect(normalizeReferralCode('abc')).toBeNull();
    expect(normalizeReferralCode('ABCDEFGHIJKLM')).toBeNull();
    expect(normalizeReferralCode('AB-12')).toBeNull();
    expect(normalizeReferralCode('')).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });
});

describe('referralCodeFromParams', () => {
  it('reads every param name a code has arrived under', () => {
    expect(referralCodeFromParams(new URLSearchParams('ref=AB12C'))).toBe('AB12C');
    expect(referralCodeFromParams(new URLSearchParams('refCode=AB12C'))).toBe('AB12C');
    expect(referralCodeFromParams(new URLSearchParams('referralCode=AB12C'))).toBe('AB12C');
    expect(referralCodeFromParams(new URLSearchParams('referral=AB12C'))).toBe('AB12C');
  });

  it('never takes the rewards screen instruction for a code', () => {
    expect(referralCodeFromParams(new URLSearchParams('referral=open'))).toBeNull();
    expect(referralCodeFromParams(new URLSearchParams('referral=OPEN&utm_medium=push'))).toBeNull();
  });

  it('skips a value that is not a code and keeps looking', () => {
    expect(referralCodeFromParams(new URLSearchParams('ref=x&referral=AB12C'))).toBe('AB12C');
    expect(referralCodeFromParams(new URLSearchParams('utm_source=invite'))).toBeNull();
  });
});

describe('parseInviteCodeFromText', () => {
  it('reads what the invite page copies', () => {
    expect(parseInviteCodeFromText('solid-invite:AB12C')).toBe('AB12C');
    expect(parseInviteCodeFromText('  SOLID-INVITE:ab12c\n')).toBe('AB12C');
  });

  it('reads invite links and old referral links', () => {
    expect(parseInviteCodeFromText('https://app.solid.xyz/invite/AB12C')).toBe('AB12C');
    expect(parseInviteCodeFromText('https://app.solid.xyz/invite/AB12C?utm=x')).toBe('AB12C');
    expect(parseInviteCodeFromText('https://www.solid.xyz/refer?ref=AB12C')).toBe('AB12C');
  });

  it('reads a bare code', () => {
    expect(parseInviteCodeFromText('ab12c')).toBe('AB12C');
  });

  it('returns null for anything else', () => {
    expect(parseInviteCodeFromText('hello world')).toBeNull();
    expect(parseInviteCodeFromText('solid-invite:')).toBeNull();
    expect(parseInviteCodeFromText('https://www.solid.xyz/refer')).toBeNull();
    expect(parseInviteCodeFromText(null)).toBeNull();
  });
});

describe('parseInstallReferrer', () => {
  it('reads the code the invite page puts in the Play referrer', () => {
    expect(parseInstallReferrer('ref=AB12C&utm_source=invite')).toBe('AB12C');
  });

  it('decodes a referrer that is still encoded', () => {
    expect(parseInstallReferrer('ref%3DAB12C%26utm_source%3Dinvite')).toBe('AB12C');
  });

  it('finds nothing in an organic install', () => {
    expect(parseInstallReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
    expect(parseInstallReferrer('')).toBeNull();
    expect(parseInstallReferrer(null)).toBeNull();
  });

  it('ignores a referrer whose code is malformed', () => {
    expect(parseInstallReferrer('ref=<script>')).toBeNull();
  });
});

describe('invite links', () => {
  it('builds the app invite link', () => {
    expect(buildInviteLink('AB12C', 'https://app.solid.xyz')).toBe(
      'https://app.solid.xyz/invite/AB12C',
    );
    expect(buildInviteLink('AB12C', 'https://app-qa.solid.xyz/')).toBe(
      'https://app-qa.solid.xyz/invite/AB12C',
    );
  });

  it('shows the link without its scheme', () => {
    expect(inviteLinkLabel('https://app.solid.xyz/invite/AB12C')).toBe(
      'app.solid.xyz/invite/AB12C',
    );
  });

  it('puts the code in the Play Store referrer, encoded once', () => {
    const url = buildPlayStoreInviteUrl(
      'AB12C',
      'https://play.google.com/store/apps/details?id=xyz.solid.android',
    );
    expect(url).toBe(
      'https://play.google.com/store/apps/details?id=xyz.solid.android&referrer=ref%3DAB12C%26utm_source%3Dinvite',
    );
    // What Play hands back is the decoded value, which the app reads on first launch.
    const referrer = new URL(url).searchParams.get('referrer');
    expect(parseInstallReferrer(referrer)).toBe('AB12C');
  });

  it('round-trips the clipboard text', () => {
    expect(parseInviteCodeFromText(inviteClipboardText('AB12C'))).toBe('AB12C');
  });
});
