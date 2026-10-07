export type ProtectionKey = 'passkey' | 'email' | 'totp';

export type ProtectionAction = 'add-email' | 'set-up-2fa';

export interface ProtectionSummary {
  items: { key: ProtectionKey; label: string; isOn: boolean }[];
  onCount: number;
  total: number;
  /** One line under the count: what is missing, or that nothing is. */
  message: string;
  /** The button the card offers, if the next missing protection has one. */
  action: { type: ProtectionAction; label: string } | null;
}

/**
 * The three protections Security counts, and what the card should ask for
 * next.
 *
 * A recovery email comes before 2FA: without one, losing the passkey means
 * losing the account, while 2FA only hardens an account that can already be
 * recovered. A missing passkey gets no button — adding one has to be approved
 * by an existing passkey, so an account without any (the shared review
 * account) has nothing to press.
 */
export const summarizeProtections = ({
  hasPasskey,
  hasEmail,
  hasTotp,
}: {
  hasPasskey: boolean;
  hasEmail: boolean;
  hasTotp: boolean;
}): ProtectionSummary => {
  const items: ProtectionSummary['items'] = [
    { key: 'passkey', label: 'Passkey', isOn: hasPasskey },
    { key: 'email', label: 'Recovery email', isOn: hasEmail },
    { key: 'totp', label: '2FA', isOn: hasTotp },
  ];
  const base = { items, onCount: items.filter(item => item.isOn).length, total: items.length };

  if (!hasEmail) {
    return {
      ...base,
      message: 'Add a recovery email so you can get back in if you lose your passkey.',
      action: { type: 'add-email', label: 'Add recovery email' },
    };
  }
  if (!hasTotp) {
    return {
      ...base,
      message: 'Add an authenticator app to finish securing your account.',
      action: { type: 'set-up-2fa', label: 'Set up 2FA' },
    };
  }
  if (!hasPasskey) {
    return { ...base, message: "Your account doesn't have a passkey yet.", action: null };
  }
  return { ...base, message: 'Your account has every protection Solid offers.', action: null };
};
