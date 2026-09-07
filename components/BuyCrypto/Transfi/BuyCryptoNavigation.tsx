import { createContext, useContext } from 'react';

import { useDepositStore } from '@/store/useDepositStore';

import type { DepositModal } from '@/lib/types';

export type BuyCryptoNavigate = (modal: DepositModal) => void;

const BuyCryptoNavigationContext = createContext<BuyCryptoNavigate | null>(null);

export const BuyCryptoNavigationProvider = ({
  navigate,
  children,
}: {
  navigate: BuyCryptoNavigate;
  children: React.ReactNode;
}) => (
  <BuyCryptoNavigationContext.Provider value={navigate}>
    {children}
  </BuyCryptoNavigationContext.Provider>
);

/** Uses an embedded flow's navigator when present, otherwise the global deposit modal. */
export const useBuyCryptoNavigation = () => {
  const embeddedNavigate = useContext(BuyCryptoNavigationContext);
  const globalNavigate = useDepositStore(state => state.setModal);

  return embeddedNavigate ?? globalNavigate;
};
