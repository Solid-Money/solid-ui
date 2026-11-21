import { createContext, useContext } from 'react';

import { useDepositStore } from '@/store/useDepositStore';

import type { DepositModal } from '@/lib/types';

export type WalletTopUpNavigate = (modal: DepositModal) => void;

const WalletTopUpNavigationContext = createContext<WalletTopUpNavigate | null>(null);

export const WalletTopUpNavigationProvider = ({
  navigate,
  children,
}: {
  navigate: WalletTopUpNavigate;
  children: React.ReactNode;
}) => (
  <WalletTopUpNavigationContext.Provider value={navigate}>
    {children}
  </WalletTopUpNavigationContext.Provider>
);

/**
 * Uses an embedded flow's navigator when present, otherwise the global deposit
 * modal — so the Wirex card's funding modal runs the same steps in its own shell,
 * as it does the Cash App and buy-crypto ones. `DEPOSIT_MODAL.CLOSE` leaves
 * whichever modal the steps are in.
 */
export const useWalletTopUpNavigation = () => {
  const embeddedNavigate = useContext(WalletTopUpNavigationContext);
  const globalNavigate = useDepositStore(state => state.setModal);

  return embeddedNavigate ?? globalNavigate;
};
