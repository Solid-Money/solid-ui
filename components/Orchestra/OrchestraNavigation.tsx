import { createContext, useContext } from 'react';

import { useDepositStore } from '@/store/useDepositStore';

import type { DepositModal } from '@/lib/types';

export type OrchestraNavigate = (modal: DepositModal) => void;

const OrchestraNavigationContext = createContext<OrchestraNavigate | null>(null);

export const OrchestraNavigationProvider = ({
  navigate,
  children,
}: {
  navigate: OrchestraNavigate;
  children: React.ReactNode;
}) => (
  <OrchestraNavigationContext.Provider value={navigate}>
    {children}
  </OrchestraNavigationContext.Provider>
);

/**
 * Uses an embedded flow's navigator when present, otherwise the global deposit
 * modal — so the same steps can run inside the card funding modals without
 * reaching for the deposit store directly.
 */
export const useOrchestraNavigation = () => {
  const embeddedNavigate = useContext(OrchestraNavigationContext);
  const globalNavigate = useDepositStore(state => state.setModal);

  return embeddedNavigate ?? globalNavigate;
};
