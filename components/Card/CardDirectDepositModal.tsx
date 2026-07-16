import React from 'react';

import { useDimension } from '@/hooks/useDimension';

import CardDirectDepositModalDesktop from './CardDirectDepositModalDesktop';
import CardDirectDepositModalMobile from './CardDirectDepositModalMobile';

interface CardDirectDepositModalProps {
  trigger: React.ReactNode;
}

/**
 * Web entry for the card deposit modal. External-wallet connect (thirdweb) is
 * desktop-only, so web-mobile (<768) renders the QR/direct-deposit-only mobile
 * variant. This also keeps thirdweb hooks off the web-mobile render path, which
 * is required now that the ThirdwebProvider is mounted on desktop only.
 */
export default function CardDirectDepositModal({ trigger }: CardDirectDepositModalProps) {
  const { isDesktop } = useDimension();

  return isDesktop ? (
    <CardDirectDepositModalDesktop trigger={trigger} />
  ) : (
    <CardDirectDepositModalMobile trigger={trigger} />
  );
}
