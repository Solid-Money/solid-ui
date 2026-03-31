import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

export const USDC_ICON = getAsset('images/usdc.png');
export const USDT_ICON = getAsset('images/usdt.png');
export const SOUSD_ICON = getAsset('images/sousd-4x.png');

export const TOKEN_ICONS: Record<string, any> = {
  USDC: USDC_ICON,
  USDT: USDT_ICON,
};

export const STATUS_TEXT = {
  pending: 'Waiting for transfer',
  detected: 'Transfer detected',
  processing: 'Processing deposit...',
  completed: 'Completed',
  failed: 'Failed',
  expired: 'Session expired',
} as const;

export type DepositStatus = keyof typeof STATUS_TEXT;

export const STATUS_TONE_CLASSES: Record<DepositStatus, string> = {
  completed: 'text-[#5BFF6C]',
  expired: 'text-red-400',
  failed: 'text-red-400',
  processing: 'text-[#F9D270]',
  detected: 'text-[#F9D270]',
  pending: 'text-foreground',
};

export const ICON_STYLE_24 = { width: 24, height: 24 };
export const NETWORK_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };
export const ICON_STYLE_18 = { width: 18, height: 18 };

export type InfoRowItemProps = {
  label: string;
  value?: string;
  valueClassName?: string;
  icon?: ReactNode;
  valueContent?: ReactNode;
  extra?: ReactNode;
  showDivider: boolean;
};

export type PriceRowItemProps = {
  label: string;
  value?: string;
  valueClassName?: string;
  valueContent?: ReactNode;
  showDivider: boolean;
};

export function useDepositDirectlyData() {
  const { vault } = useVaultDepositConfig();
  const {
    walletAddress,
    chainId: rawChainId,
    selectedToken: rawSelectedToken,
    sessionId,
    fromActivity,
    minDeposit: rawMinDeposit,
    fee: rawFee,
  } = useDepositStore(
    useShallow(state => ({
      walletAddress: state.directDepositSession.walletAddress,
      chainId: state.directDepositSession.chainId,
      selectedToken: state.directDepositSession.selectedToken,
      sessionId: state.directDepositSession.sessionId,
      fromActivity: state.directDepositSession.fromActivity,
      minDeposit: state.directDepositSession.minDeposit,
      fee: state.directDepositSession.fee,
    })),
  );

  const setModal = useDepositStore(state => state.setModal);
  const clearDirectDepositSession = useDepositStore(state => state.clearDirectDepositSession);

  const chainId = rawChainId || mainnet.id;
  const selectedToken = rawSelectedToken || 'USDC';

  const tokenIcon = useMemo(
    () =>
      BRIDGE_TOKENS[chainId]?.tokens?.[selectedToken]?.icon ||
      TOKEN_ICONS[selectedToken] ||
      USDC_ICON,
    [chainId, selectedToken],
  );

  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const { maxAPY, isAPYsLoading } = useMaxAPY();
  const hasTrackedAddressView = useRef(false);

  const tokenAddress =
    BRIDGE_TOKENS[chainId]?.tokens?.[selectedToken]?.address ||
    BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address;
  const { exchangeRate } = usePreviewDeposit('10', tokenAddress, chainId);

  const network = BRIDGE_TOKENS[chainId];

  const status: DepositStatus = 'pending';
  const isExpired = false;

  useEffect(() => {
    if (!hasTrackedAddressView.current && walletAddress) {
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_ADDRESS_VIEWED, {
        deposit_method: 'deposit_directly',
        session_id: sessionId,
        chain_id: chainId,
        selected_token: selectedToken,
        wallet_address: walletAddress,
      });
      hasTrackedAddressView.current = true;
    }
  }, [walletAddress, chainId, selectedToken, sessionId]);

  const handleDone = useCallback(() => {
    setModal(DEPOSIT_MODAL.CLOSE);
    clearDirectDepositSession();
    if (!fromActivity) {
      router.push(path.ACTIVITY);
    }
  }, [clearDirectDepositSession, fromActivity, setModal]);

  const handleCopy = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_DIRECT_ADDRESS_COPIED, {
      deposit_method: 'deposit_directly',
      session_id: sessionId,
      chain_id: chainId,
      selected_token: selectedToken,
    });
  }, [chainId, selectedToken, sessionId]);

  const handleQrOpen = useCallback(() => {
    setIsQrDialogOpen(true);

    track(TRACKING_EVENTS.DEPOSIT_DIRECT_QR_VIEWED, {
      deposit_method: 'deposit_directly',
      session_id: sessionId,
      chain_id: chainId,
      selected_token: selectedToken,
    });
  }, [chainId, selectedToken, sessionId]);

  const estimatedTime = useMemo(
    () =>
      chainId === 1
        ? '5 minutes'
        : chainId === 122 && (selectedToken === 'WFUSE' || selectedToken === 'soFUSE')
          ? '2 minutes'
          : '30 minutes',
    [chainId, selectedToken],
  );

  const formattedAPY = maxAPY !== undefined ? `${maxAPY.toFixed(2)}%` : '—';

  const minDeposit = vault.minimumAmount || rawMinDeposit || '0.0001';
  const fee = rawFee || '0';

  const networkName = network?.name || 'Ethereum';
  const networkIcon = network?.icon;

  const soUSDAmount = useMemo(() => {
    const usdcAmount = 10;
    return exchangeRate ? usdcAmount / Number(formatUnits(exchangeRate, 6)) : usdcAmount;
  }, [exchangeRate]);

  const formattedExchangeRate = useMemo(
    () => formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 1, 4, 4),
    [exchangeRate],
  );

  const formattedSoUSDAmount = useMemo(() => formatNumber(soUSDAmount, 2, 2), [soUSDAmount]);

  const statusValue = STATUS_TEXT[status];
  const statusClassName = `${STATUS_TONE_CLASSES[status]} font-medium`;
  const minDepositValue = `${minDeposit} ${selectedToken}`;
  const feeValue = `${fee} ${selectedToken}`;

  return {
    walletAddress,
    chainId,
    selectedToken,
    sessionId,
    fromActivity,
    tokenIcon,
    network,
    networkName,
    networkIcon,
    estimatedTime,
    formattedAPY,
    exchangeRate,
    soUSDAmount,
    formattedExchangeRate,
    formattedSoUSDAmount,
    minDeposit,
    fee,
    minDepositValue,
    feeValue,
    statusValue,
    statusClassName,
    status,
    isExpired,
    isAPYsLoading,
    maxAPY,
    isQrDialogOpen,
    setIsQrDialogOpen,
    handleDone,
    handleCopy,
    handleQrOpen,
    setModal,
    clearDirectDepositSession,
  };
}
