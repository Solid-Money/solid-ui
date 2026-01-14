import { useEffect, useState } from 'react';

import CardDepositModalProvider from '@/components/Card/CardDepositModalProvider';
import DepositFromSafeAccountModalProvider from '@/components/Deposit/DepositFromSafeAccountModalProvider';
import DepositModalProvider from '@/components/DepositOption/DepositModalProvider';
import SendModalProvider from '@/components/Send/SendModalProvider';
import StakeModalProvider from '@/components/Stake/StakeModalProvider';
import SwapModalProvider from '@/components/Swap/SwapModalProvider';
import UnstakeModalProvider from '@/components/Unstake/UnstakeModalProvider';
import WithdrawModalProvider from '@/components/Withdraw/WithdrawModalProvider';

/**
 * Deferred modal providers component.
 *
 * All modal providers are grouped here and mounted after a short delay
 * to avoid blocking the initial render. This reduces FCP by deferring
 * the initialization of 8 modal components until after first paint.
 *
 * Since modals use Zustand stores, they remain fully functional once mounted.
 */
const DeferredModalProviders = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer mounting modal providers until after first paint
    // Using requestAnimationFrame ensures we wait for the current frame to complete
    const frameId = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <DepositModalProvider />
      <SendModalProvider />
      <SwapModalProvider />
      <WithdrawModalProvider />
      <StakeModalProvider />
      <UnstakeModalProvider />
      <DepositFromSafeAccountModalProvider />
      <CardDepositModalProvider />
    </>
  );
};

export default DeferredModalProviders;
