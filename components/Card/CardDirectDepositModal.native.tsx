import React from 'react';

import { useCardProvider } from '@/hooks/useCardProvider';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

import CardDirectDepositModalMobile from './CardDirectDepositModalMobile';

import type { CardDirectDepositModalProps } from './CardDirectDepositModal';

/**
 * Native uses the shared mobile (QR / direct-deposit) variant — no thirdweb; the
 * external-wallet connect path is web-desktop only.
 *
 * Same Wirex guard as the web entry: a Wirex card has no balance to deposit into,
 * so this renders nothing rather than a deposit flow with no destination. Kept here
 * too because Metro resolves this file instead of CardDirectDepositModal.tsx on
 * iOS/Android, so a guard in that file alone would not apply on device.
 */
export default function CardDirectDepositModal(props: CardDirectDepositModalProps) {
  const { provider } = useCardProvider();

  if (!canDepositToCard(provider)) return null;

  return <CardDirectDepositModalMobile {...props} />;
}
