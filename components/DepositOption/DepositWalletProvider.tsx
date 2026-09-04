import { ReactNode } from 'react';

import { LazyThirdwebProvider } from '@/components/LazyThirdwebProvider';
import ThirdwebConnectionBridge from '@/components/ThirdwebConnectionBridge';
import { useDimension } from '@/hooks/useDimension';

type DepositWalletProviderProps = {
  active: boolean;
  children: ReactNode;
};

/**
 * Desktop already has a thirdweb provider at the app root. Mobile loads one only
 * while the connected-wallet deposit flow is active, keeping it off first paint.
 */
const DepositWalletProvider = ({ active, children }: DepositWalletProviderProps) => {
  const { isDesktop } = useDimension();
  const needsLocalProvider = active && !isDesktop;

  return (
    <LazyThirdwebProvider enabled={needsLocalProvider}>
      {needsLocalProvider ? <ThirdwebConnectionBridge /> : null}
      {children}
    </LazyThirdwebProvider>
  );
};

export default DepositWalletProvider;
