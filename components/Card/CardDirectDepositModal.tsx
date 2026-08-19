import React from 'react';

import { useCardProvider } from '@/hooks/useCardProvider';
import { useDimension } from '@/hooks/useDimension';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

import CardDirectDepositModalDesktop from './CardDirectDepositModalDesktop';
import CardDirectDepositModalMobile from './CardDirectDepositModalMobile';

export interface CardDirectDepositModalProps {
  /** Omit (or pass null) when driving the modal with isOpen/onOpenChange. */
  trigger?: React.ReactNode;
  /** Controlled mode: when provided, the modal no longer owns its open state. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Web entry for the card deposit modal. External-wallet connect (thirdweb) is
 * desktop-only, so web-mobile (<768) renders the QR/direct-deposit-only mobile
 * variant. This also keeps thirdweb hooks off the web-mobile render path, which
 * is required now that the ThirdwebProvider is mounted on desktop only.
 *
 * Renders nothing for a Wirex cardholder. Every entry point already hides its own
 * trigger (`canDepositToCard`), but this is the one chokepoint they all pass
 * through — so a surface that forgets the check shows no modal rather than a
 * deposit flow with no destination to deposit to.
 */
export default function CardDirectDepositModal(props: CardDirectDepositModalProps) {
  const { isDesktop } = useDimension();
  const { provider } = useCardProvider();

  if (!canDepositToCard(provider)) return null;

  return isDesktop ? (
    <CardDirectDepositModalDesktop {...props} />
  ) : (
    <CardDirectDepositModalMobile {...props} />
  );
}
