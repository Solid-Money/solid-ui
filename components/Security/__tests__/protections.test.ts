import { summarizeProtections } from '@/components/Security/protections';

describe('summarizeProtections', () => {
  it('asks for 2FA when it is the only protection off', () => {
    const summary = summarizeProtections({ hasPasskey: true, hasEmail: true, hasTotp: false });

    expect(summary.onCount).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.message).toBe('Add an authenticator app to finish securing your account.');
    expect(summary.action).toEqual({ type: 'set-up-2fa', label: 'Set up 2FA' });
  });

  it('asks for a recovery email before 2FA', () => {
    // Without an email, losing the passkey is losing the account.
    const summary = summarizeProtections({ hasPasskey: true, hasEmail: false, hasTotp: false });

    expect(summary.onCount).toBe(1);
    expect(summary.action).toEqual({ type: 'add-email', label: 'Add recovery email' });
  });

  it('offers nothing once every protection is on', () => {
    const summary = summarizeProtections({ hasPasskey: true, hasEmail: true, hasTotp: true });

    expect(summary.onCount).toBe(3);
    expect(summary.action).toBeNull();
    expect(summary.message).toBe('Your account has every protection Solid offers.');
  });

  it('has no button for a missing passkey, which only a passkey can add', () => {
    const summary = summarizeProtections({ hasPasskey: false, hasEmail: true, hasTotp: true });

    expect(summary.onCount).toBe(2);
    expect(summary.action).toBeNull();
  });

  it('lists the protections in the order the card shows them', () => {
    const summary = summarizeProtections({ hasPasskey: true, hasEmail: true, hasTotp: false });

    expect(summary.items.map(item => [item.label, item.isOn])).toEqual([
      ['Passkey', true],
      ['Recovery email', true],
      ['2FA', false],
    ]);
  });
});
