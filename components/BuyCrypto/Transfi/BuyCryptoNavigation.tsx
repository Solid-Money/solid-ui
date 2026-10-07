import { createContext, useContext } from 'react';

import { useDepositStore } from '@/store/useDepositStore';

import type { DepositModal } from '@/lib/types';
import type { KycFlow } from '@/store/useKycStore';

export type BuyCryptoNavigate = (modal: DepositModal) => void;

/** The TransFi KYC flows: they differ only in where the user returns to. */
export type TransfiKycFlow = Extract<KycFlow, 'transfi' | 'transfi_cashout'>;

const BuyCryptoNavigationContext = createContext<BuyCryptoNavigate | null>(null);
const BuyCryptoKycFlowContext = createContext<TransfiKycFlow>('transfi');

export const BuyCryptoNavigationProvider = ({
  navigate,
  kycFlow = 'transfi',
  children,
}: {
  navigate: BuyCryptoNavigate;
  /** Where an identity check started from these screens returns to. */
  kycFlow?: TransfiKycFlow;
  children: React.ReactNode;
}) => (
  <BuyCryptoNavigationContext.Provider value={navigate}>
    <BuyCryptoKycFlowContext.Provider value={kycFlow}>{children}</BuyCryptoKycFlowContext.Provider>
  </BuyCryptoNavigationContext.Provider>
);

/** Uses an embedded flow's navigator when present, otherwise the global deposit modal. */
export const useBuyCryptoNavigation = () => {
  const embeddedNavigate = useContext(BuyCryptoNavigationContext);
  const globalNavigate = useDepositStore(state => state.setModal);

  return embeddedNavigate ?? globalNavigate;
};

/** The KYC flow the surrounding screens belong to; `transfi` outside any provider. */
export const useBuyCryptoKycFlow = (): TransfiKycFlow => useContext(BuyCryptoKycFlowContext);
