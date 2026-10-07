import { useCallback, useMemo } from 'react';

import { getUsdcAddress } from '@/constants/bridge';
import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

import type { DepositModal } from '@/lib/types';

/**
 * Navigator for the TransFi KYC screens embedded in the Send drawer.
 *
 * Those screens are shared with buy crypto and speak in deposit-drawer steps,
 * so this translates: their "amount" step — where a verified user goes next —
 * is the start of the cash-out; "close" closes the Send drawer; "options" is
 * back to search; every other step is a KYC screen, shown in OPEN_CASHOUT_KYC.
 */
export const useCashoutKycNavigate = () => {
  const setModal = useSendStore(state => state.setModal);
  const setKycModal = useCashoutStore(state => state.setKycModal);

  return useCallback(
    (modal: DepositModal) => {
      switch (modal.name) {
        case DEPOSIT_MODAL.CLOSE.name:
          setKycModal(null);
          setModal(SEND_MODAL.CLOSE);
          return;
        case DEPOSIT_MODAL.OPEN_OPTIONS.name:
          setKycModal(null);
          setModal(SEND_MODAL.OPEN_SEND_SEARCH);
          return;
        case DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT.name:
          setKycModal(null);
          setModal(SEND_MODAL.OPEN_CASHOUT_CURRENCY);
          return;
        default:
          setKycModal(modal);
          setModal(SEND_MODAL.OPEN_CASHOUT_KYC);
      }
    },
    [setKycModal, setModal],
  );
};

/**
 * Start a cash-out: the same KYC gate buy crypto uses (ready → straight in;
 * otherwise the consent / pending / identity screens), with an identity check
 * returning here rather than to the buy drawer.
 */
export const useCashoutEntry = () => {
  const navigate = useCashoutKycNavigate();
  const { handleBuyCryptoPress, isChecking } = useBuyCryptoEntry(navigate, 'transfi_cashout');
  return { startCashout: handleBuyCryptoPress, isChecking };
};

/** The USDC the user can cash out: their balance on the chain the cash-out sends from. */
export const useCashoutUsdc = (chainId?: number) => {
  const { tokens, isLoading } = useWalletTokens();

  return useMemo(() => {
    if (!chainId) return { isLoading };
    let address: string;
    try {
      address = getUsdcAddress(chainId);
    } catch {
      return { isLoading };
    }
    const token = tokens.find(
      t => t.chainId === chainId && t.contractAddress.toLowerCase() === address.toLowerCase(),
    );
    const decimals = token?.contractDecimals ?? 6;
    const balanceWei = BigInt(token?.balance || '0');
    return {
      isLoading,
      token,
      tokenAddress: address as `0x${string}`,
      decimals,
      balanceWei,
    };
  }, [chainId, isLoading, tokens]);
};
