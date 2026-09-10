import {
  getUsernameFormatError,
  isUsernameFormatValid,
  isUsernameTakenError,
  normalizeUsername,
  sanitizeUsernameInput,
  suggestUsernameFromEmail,
  USERNAME_MAX_LENGTH,
} from '@/lib/utils/username';

describe('normalizeUsername', () => {
  it('stores one handle for a name typed either way', () => {
    expect(normalizeUsername('  Countess  ')).toBe('countess');
    expect(normalizeUsername('COUNTESS')).toBe(normalizeUsername('countess'));
  });
});

describe('sanitizeUsernameInput', () => {
  it('lowercases as the user types', () => {
    expect(sanitizeUsernameInput('Ada')).toBe('ada');
  });

  it('drops characters a handle cannot contain', () => {
    // Otherwise the field accepts input the server will reject on submit.
    expect(sanitizeUsernameInput('ada lovelace')).toBe('adalovelace');
    expect(sanitizeUsernameInput('ada@lovelace!')).toBe('adalovelace');
  });

  it('keeps the punctuation a handle may contain', () => {
    expect(sanitizeUsernameInput('ada.love_lace-1')).toBe('ada.love_lace-1');
  });

  it('stops at the maximum length', () => {
    expect(sanitizeUsernameInput('a'.repeat(60))).toHaveLength(USERNAME_MAX_LENGTH);
  });

  it('leaves a trailing space alone rather than eating it mid-word', () => {
    // Trimming here would fight the user: the space is how they reach the next
    // word, and it is removed anyway before anything is submitted.
    expect(sanitizeUsernameInput('ada ')).toBe('ada');
  });
});

describe('getUsernameFormatError', () => {
  it('accepts a well-formed handle', () => {
    expect(getUsernameFormatError('countess')).toBeNull();
    expect(getUsernameFormatError('ada.lovelace_1-x')).toBeNull();
    expect(isUsernameFormatValid('countess')).toBe(true);
  });

  it('asks for a handle when the field is empty', () => {
    expect(getUsernameFormatError('')).toBe('Please choose a username');
    expect(getUsernameFormatError('   ')).toBe('Please choose a username');
  });

  it('rejects a handle that is too short', () => {
    expect(getUsernameFormatError('ab')).toMatch(/at least 3/);
  });

  it('rejects a handle that is too long', () => {
    expect(getUsernameFormatError('a'.repeat(USERNAME_MAX_LENGTH + 1))).toMatch(/exceed 30/);
  });

  it('rejects characters a handle cannot contain', () => {
    expect(getUsernameFormatError('ada lovelace')).toMatch(/can only contain/);
    expect(getUsernameFormatError('ada@lovelace')).toMatch(/can only contain/);
  });

  it('judges the normalised form, not what was typed', () => {
    // The value is lowercased before it is stored, so uppercase is not an error.
    expect(getUsernameFormatError('Countess')).toBeNull();
    expect(getUsernameFormatError('  countess  ')).toBeNull();
  });
});

describe('isUsernameTakenError', () => {
  const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });

  it('recognises the handle-was-claimed conflict', () => {
    expect(isUsernameTakenError(conflict('This username is already taken'))).toBe(true);
  });

  it('does not treat the registered-email conflict as one', () => {
    // Same 409, but choosing another handle would not fix it — sending the
    // user back to the username step would strand them there.
    expect(isUsernameTakenError(conflict('Email already registered'))).toBe(false);
  });

  it('ignores failures that are not conflicts', () => {
    expect(
      isUsernameTakenError(
        Object.assign(new Error('This username is already taken'), { status: 500 }),
      ),
    ).toBe(false);
    expect(isUsernameTakenError(new Error('Network request failed'))).toBe(false);
    expect(isUsernameTakenError(undefined)).toBe(false);
    expect(isUsernameTakenError(null)).toBe(false);
  });
});

describe('suggestUsernameFromEmail', () => {
  it('offers the handle the user would previously have been assigned', () => {
    expect(suggestUsernameFromEmail('ada.lovelace@example.com')).toBe('ada.lovelace');
  });

  it('cleans a prefix that is not a usable handle as-is', () => {
    expect(suggestUsernameFromEmail('Ada+Newsletter@example.com')).toBe('adanewsletter');
  });

  it('suggests nothing rather than a name the user did not choose', () => {
    // Too short to submit, so pre-filling it would only produce an error.
    expect(suggestUsernameFromEmail('ab@example.com')).toBe('');
    expect(suggestUsernameFromEmail('+@example.com')).toBe('');
  });

  it('never suggests something the field itself would reject', () => {
    const suggestion = suggestUsernameFromEmail('A.Very.Long.Name.That.Runs.On@example.com');

    expect(suggestion).not.toBe('');
    expect(getUsernameFormatError(suggestion)).toBeNull();
  });
});
