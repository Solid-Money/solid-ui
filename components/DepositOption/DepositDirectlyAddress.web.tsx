import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy, Fuel, Info, MessageCircle, Share2 } from 'lucide-react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import CopyToClipboard from '@/components/CopyToClipboard';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { getAsset } from '@/lib/assets';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

const USDC_ICON = getAsset('images/usdc.png');
const USDT_ICON = getAsset('images/usdt.png');
const SOUSD_ICON = getAsset('images/sousd-4x.png');

const TOKEN_ICONS: Record<string, any> = {
  USDC: USDC_ICON,
  USDT: USDT_ICON,
};

const STATUS_TEXT = {
  pending: 'Waiting for transfer',
  detected: 'Transfer detected',
  processing: 'Processing deposit...',
  completed: 'Completed',
  failed: 'Failed',
  expired: 'Session expired',
} as const;

type DepositStatus = keyof typeof STATUS_TEXT;

const STATUS_TONE_CLASSES: Record<DepositStatus, string> = {
  completed: 'text-[#5BFF6C]',
  expired: 'text-red-400',
  failed: 'text-red-400',
  processing: 'text-[#F9D270]',
  detected: 'text-[#F9D270]',
  pending: 'text-foreground',
};

type InfoRow = {
  label: string;
  value?: string;
  valueClassName?: string;
  extra?: ReactNode;
  icon?: ReactNode;
  valueContent?: ReactNode;
};

const DepositDirectlyAddress = () => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { directDepositSession, setModal, clearDirectDepositSession } = useDepositStore(
    useShallow(state => ({
      directDepositSession: state.directDepositSession,
      setModal: state.setModal,
      clearDirectDepositSession: state.clearDirectDepositSession,
    })),
  );
  const chainId = directDepositSession.chainId || 1;
  const selectedToken = directDepositSession.selectedToken || 'USDC';
  const tokenIcon = TOKEN_ICONS[selectedToken] || USDC_ICON;
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'error' | null>(null);
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const intercom = useIntercom();

  // Get token address for exchange rate calculation
  const tokenAddress =
    BRIDGE_TOKENS[chainId]?.tokens?.[selectedToken]?.address ||
    BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address;

  const { exchangeRate } = usePreviewDeposit('10', tokenAddress, chainId);

  const network = BRIDGE_TOKENS[chainId];
  const walletAddress = directDepositSession.walletAddress;

  // Hardcoded status - always show "Waiting for transfer"
  const status: DepositStatus = 'pending';
  const isExpired = false;

  useEffect(() => {
    if (!shareFeedback) return;
    const timer = setTimeout(() => setShareFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [shareFeedback]);

  const handleDone = useCallback(() => {
    setModal(DEPOSIT_MODAL.CLOSE);
    clearDirectDepositSession();
    if (!directDepositSession.fromActivity) {
      router.push(path.ACTIVITY);
    }
  }, [setModal, clearDirectDepositSession, directDepositSession.fromActivity]);

  const handleShare = useCallback(async () => {
    if (!walletAddress) return;

    try {
      if ('share' in navigator && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Solid deposit address', text: walletAddress });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress);
        setShareFeedback('copied');
        return;
      }

      setShareFeedback('error');
    } catch (error) {
      console.error('Failed to share deposit address:', error);
      setShareFeedback('error');
    }
  }, [walletAddress]);

  const estimatedTime = chainId === 1 ? '5 minutes' : '30 minutes';
  const formattedAPY = maxAPY !== undefined ? `${maxAPY.toFixed(2)}%` : '—';

  const minDeposit =
    EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT || directDepositSession.minDeposit || '0.0001';

  const fee = directDepositSession.fee || '0';

  const infoRows: InfoRow[] = useMemo(
    () => [
      { label: 'Min deposit', value: `${minDeposit} ${selectedToken}` },
      { label: 'Estimated time', value: estimatedTime },
      {
        label: 'Status',
        value: STATUS_TEXT[status],
        valueClassName: `${STATUS_TONE_CLASSES[status]} font-medium`,
      },
      { label: 'Fee', value: `${fee} ${selectedToken}`, icon: <Fuel size={16} color="#A1A1AA" /> },
    ],
    [minDeposit, estimatedTime, status, fee, selectedToken],
  );

  const priceRows: InfoRow[] = useMemo(() => {
    const rows: InfoRow[] = [];

    // Calculate soUSD amount for 10 USDC
    const usdcAmount = 10;

    const soUSDAmount = exchangeRate
      ? usdcAmount / Number(formatUnits(exchangeRate, 6))
      : usdcAmount;

    rows.push({
      label: 'You will receive',
      valueContent: (
        <View className="flex flex-row items-center gap-1.5">
          <Image source={SOUSD_ICON} style={{ width: 18, height: 18 }} contentFit="cover" />
          <Text className="text-base font-medium text-white">
            {formatNumber(soUSDAmount, 2, 2)}{' '}
            <Text className="text-white/70">soUSD on Ethereum</Text>
          </Text>
        </View>
      ),
    });

    rows.push({
      label: 'Price',
      valueContent: (
        <Text className="text-base font-medium text-white">
          1 soUSD = {formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 1, 4, 4)}{' '}
          {selectedToken}
        </Text>
      ),
    });

    rows.push({
      label: 'APY',
      valueContent: isMaxAPYsLoading ? (
        <Skeleton className="h-7 w-16 bg-white/20" />
      ) : (
        <Text className="text-base font-medium text-[#94F27F]">{formattedAPY}</Text>
      ),
    });

    return rows;
  }, [exchangeRate, isMaxAPYsLoading, formattedAPY, selectedToken]);

  return (
    <View className="flex flex-col gap-3 md:gap-4 2xl:gap-6">
      <View className="flex flex-row flex-wrap items-center justify-center">
        <Text className="text-xl font-bold text-[#ACACAC] md:text-2xl">Transfer</Text>
        <View className="flex flex-row items-center gap-1 px-1">
          <Image source={tokenIcon} style={{ width: 21, height: 21 }} contentFit="cover" />
          <Text className="text-xl font-bold text-white md:text-2xl">{selectedToken}</Text>
        </View>
        <Text className="text-xl font-semibold text-[#ACACAC] md:text-2xl">to this</Text>
        <View className="flex flex-row items-center gap-1 px-2 2xl:px-3">
          {network?.icon && (
            <Image
              source={typeof network.icon === 'string' ? { uri: network.icon } : network.icon}
              style={{ width: 21, height: 21, borderRadius: 9 }}
              contentFit="cover"
              accessibilityLabel={network?.name}
            />
          )}
          <Text className="text-xl font-semibold text-[#ACACAC] md:text-2xl">
            <Text className="text-white">{network?.name || 'Ethereum'}</Text>{' '}
            <Text className="text-[#ACACAC]">address</Text>
          </Text>
        </View>
      </View>

      <View className="mt-2 w-full rounded-[20px] bg-card p-4 md:px-6 md:py-4">
        <View className="flex flex-col gap-4">
          <View className="flex flex-row items-center justify-center">
            <Text className="text-center text-lg font-semibold tracking-wide text-foreground">
              {walletAddress ? eclipseAddress(walletAddress, 6, 6) : '—'}
            </Text>
            <CopyToClipboard
              text={walletAddress || ''}
              className="h-10 w-10 bg-transparent web:hover:bg-transparent web:active:bg-transparent md:h-12 md:w-12"
              iconClassName="text-white"
            />
          </View>

          <View className="grid grid-cols-2 gap-4 pb-1">
            <Button
              variant="secondary"
              onPress={() => setIsQrDialogOpen(true)}
              className="h-9 rounded-2xl border-0 bg-secondary-hover web:hover:brightness-110"
            >
              <Copy size={14} color="white" />
              <Text className="text-[1rem] font-bold text-white md:text-lg">Show QR</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={handleShare}
              className="h-9 rounded-2xl border-0 bg-secondary-hover web:hover:brightness-110"
            >
              <Share2 size={18} color="white" />
              <Text className="text-[1rem] font-bold text-white md:text-lg">Share</Text>
            </Button>
          </View>

          {shareFeedback && (
            <Text className="text-xs text-muted-foreground">
              {shareFeedback === 'copied'
                ? 'Address copied to clipboard.'
                : 'Sharing not supported in this browser.'}
            </Text>
          )}
        </View>
      </View>

      {/* Warning Text */}
      <View className="flex flex-row items-center justify-center gap-1.5 px-4">
        <Info size={16} color="#A1A1AA" />
        <Text className="my-2 text-center text-sm text-[#A1A1AA] md:my-0">
          Please send only {selectedToken} to this address
        </Text>
        <TooltipPopover
          text="Sending any other token may result in permanent loss of funds."
          analyticsContext="deposit_directly_warning"
          side="top"
        />
      </View>

      {/* Yield Info Rows */}
      {!isExpired && (
        <View className="flex w-full flex-col rounded-2xl bg-card">
          {priceRows.map((row, index) => (
            <View key={row.label} className="flex flex-col">
              <View className="flex flex-row items-center justify-between gap-1.5 px-5 py-4 md:gap-2 md:px-6 2xl:gap-3">
                <Text className="text-[1rem] font-medium text-primary/70">{row.label}</Text>
                <View className="flex items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`text-[1rem] font-medium text-foreground ${
                        row.valueClassName ? row.valueClassName : ''
                      }`}
                    >
                      {row.value}
                    </Text>
                  )}
                  {row.extra}
                </View>
              </View>
              {index !== priceRows.length - 1 && <View className="ml-5 h-px bg-primary/10" />}
            </View>
          ))}
        </View>
      )}

      {/* Details Info Rows */}
      {!isExpired && (
        <View className="flex w-full flex-col rounded-2xl bg-card">
          {infoRows.map((row, index) => (
            <View key={row.label} className="flex flex-col">
              <View className="flex flex-row items-center justify-between gap-1.5 px-5 py-4 md:gap-2 md:px-6 2xl:gap-3">
                <View className="flex-row items-center gap-1.5 md:gap-2">
                  {row.icon}
                  <Text className="text-[1rem] font-medium text-primary/70">{row.label}</Text>
                </View>
                <View className="flex items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`text-[1rem] font-medium text-foreground ${
                        row.valueClassName ? row.valueClassName : ''
                      }`}
                    >
                      {row.value}
                    </Text>
                  )}
                  {row.extra}
                </View>
              </View>
              {index !== infoRows.length - 1 && <View className="ml-5 h-px bg-primary/10" />}
            </View>
          ))}
        </View>
      )}

      {isExpired && (
        <View className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-center md:px-4 md:py-4 2xl:px-6 2xl:py-5">
          <Text className="text-base font-medium text-red-400">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      <Button
        onPress={handleDone}
        className="mt-2 h-14 w-full rounded-2xl bg-[#94F27F] web:hover:bg-[#94F27F]/90"
      >
        <Text className="text-lg font-bold text-black">Done</Text>
      </Button>

      {/* Need help? */}
      <View className="flex items-center justify-center pb-4">
        <Button
          variant="ghost"
          className="flex flex-row items-center gap-2 hover:bg-transparent"
          onPress={() => intercom?.show()}
        >
          <MessageCircle size={18} color="#A1A1AA" />
          <Text className="font-medium text-[#A1A1AA]">Need help?</Text>
        </Button>
      </View>

      <ResponsiveDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        title="Scan to deposit"
        contentClassName="px-3 md:px-4 2xl:px-6 py-4 md:py-6 2xl:py-8"
      >
        <View className="flex flex-col items-center gap-3 md:gap-4 2xl:gap-5">
          <View className="rounded-3xl bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.25)] md:p-4 2xl:p-5">
            <QRCode value={walletAddress || ''} size={220} backgroundColor="white" color="black" />
          </View>
          <Text className="text-center text-xs text-muted-foreground md:text-sm">
            Share this QR code with the sender or scan it from another device to populate the wallet
            address automatically.
          </Text>
        </View>
      </ResponsiveDialog>
    </View>
  );
};

export default DepositDirectlyAddress;
