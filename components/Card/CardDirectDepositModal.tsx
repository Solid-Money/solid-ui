import React from 'react';

import { useDimension } from '@/hooks/useDimension';

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
 */
export default function CardDirectDepositModal(props: CardDirectDepositModalProps) {
  const { isDesktop } = useDimension();

  return isDesktop ? (
    <CardDirectDepositModalDesktop {...props} />
  ) : (
    <CardDirectDepositModalMobile {...props} />
  );
}
