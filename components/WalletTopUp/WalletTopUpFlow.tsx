import { WalletTopUpAmount } from '@/components/WalletTopUp/WalletTopUpAmount';
import {
  WalletTopUpNavigate,
  WalletTopUpNavigationProvider,
} from '@/components/WalletTopUp/WalletTopUpNavigation';
import { WalletTopUpReview } from '@/components/WalletTopUp/WalletTopUpReview';
import { WalletTopUpStatus } from '@/components/WalletTopUp/WalletTopUpStatus';
import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

/**
 * The top-up steps, rendered inside a host's own modal.
 *
 * The Add-funds modal renders these through useDepositOption instead; this is
 * for the Wirex card's funding modal, which runs the same steps in its own shell
 * and supplies its own navigator. Every step calls useWalletTopUpNavigation
 * rather than the deposit store, which is what makes that substitution work.
 */
export const WalletTopUpFlowContent = ({
  modal,
  navigate,
}: {
  modal: DepositModal;
  navigate: WalletTopUpNavigate;
}) => (
  <WalletTopUpNavigationProvider navigate={navigate}>
    {modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW.name ? (
      <WalletTopUpReview />
    ) : modal.name === DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS.name ? (
      <WalletTopUpStatus />
    ) : (
      <WalletTopUpAmount />
    )}
  </WalletTopUpNavigationProvider>
);

export default WalletTopUpFlowContent;
