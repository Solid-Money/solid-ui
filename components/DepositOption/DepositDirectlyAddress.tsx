import CopyToClipboard from '@/components/CopyToClipboard';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useMaxAPY } from '@/hooks/useAnalytics';

import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import useUser from '@/hooks/useUser';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy, Fuel, Info, MessageCircle, Share2 } from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';

const USDC_ICON = require('@/assets/images/usdc.png');
const USDT_ICON = require('@/assets/images/usdt.png');
const SOUSD_ICON = require('@/assets/images/sousd-4x.png');

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
  const { user } = useUser();
  const { directDepositSession, setModal, clearDirectDepositSession } = useDepositStore();
  const chainId = directDepositSession.chainId || mainnet.id;
  const selectedToken = directDepositSession.selectedToken || 'USDC';
  const tokenIcon = TOKEN_ICONS[selectedToken] || USDC_ICON;
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [shareError, setShareError] = useState(false);
  const { maxAPY, isAPYsLoading } = useMaxAPY();
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

  // Clear share error after timeout
  useEffect(() => {
    if (!shareError) return;
    const timer = setTimeout(() => setShareError(false), 2500);
    return () => clearTimeout(timer);
  }, [shareError]);

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
      await Share.share({ message: walletAddress, title: 'Solid deposit address' });
    } catch (error) {
      console.error('Failed to share deposit address:', error);
      setShareError(true);
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
        <View className="flex-row items-center gap-1.5">
          <Image source={SOUSD_ICON} style={{ width: 18, height: 18 }} contentFit="cover" />
          <Text className="font-bold text-white text-base">
            {formatNumber(soUSDAmount, 2, 2)}{' '}
            <Text className="text-white/70">soUSD on Ethereum</Text>
          </Text>
        </View>
      ),
    });

    rows.push({
      label: 'Price',
      valueContent: (
        <Text className="font-bold text-white text-base">
          1 soUSD = {formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 1, 4, 4)}{' '}
          {selectedToken}
        </Text>
      ),
    });

    rows.push({
      label: 'APY',
      valueContent: isAPYsLoading ? (
        <Skeleton className="h-7 w-16 bg-white/20" />
      ) : (
        <Text className="font-bold text-[#94F27F] text-base">{formattedAPY}</Text>
      ),
    });

    return rows;
  }, [exchangeRate, isAPYsLoading, formattedAPY]);

  return (
    <View className="flex-col gap-3">
      {/* Header - Transfer token to this address */}
      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-xl font-bold text-[#ACACAC]">Transfer</Text>
        <View className="flex-row items-center gap-1 px-1">
          <Image source={tokenIcon} style={{ width: 21, height: 21 }} contentFit="cover" />
          <Text className="text-xl font-bold text-white">{selectedToken}</Text>
        </View>
        <Text className="text-xl font-semibold text-[#ACACAC]">to this</Text>
        <View className="flex-row items-center gap-1 px-2">
          <Image
            source={network?.icon}
            style={{ width: 21, height: 21, borderRadius: 9 }}
            contentFit="cover"
          />
          <Text className="text-xl font-semibold text-[#ACACAC]">
            {network?.name || 'Ethereum'} address
          </Text>
        </View>
      </View>

      {/* Address card */}
      <View className="w-full rounded-[20px] bg-accent mt-2 p-4">
        <View className="gap-4">
          <View className="flex-row items-center justify-center">
            <Text className="text-lg tracking-wide text-foreground text-center">
              {walletAddress ? eclipseAddress(walletAddress, 6, 6) : '—'}
            </Text>
            <CopyToClipboard
              text={walletAddress || ''}
              className="h-10 w-10 bg-transparent"
              iconClassName="text-white"
            />
          </View>

          <View className="flex-row gap-4 pb-1">
            <Button
              variant="secondary"
              onPress={() => setIsQrDialogOpen(true)}
              className="h-9 flex-1 rounded-2xl bg-secondary-hover border-0"
            >
              <Copy size={14} color="white" />
              <Text className="font-bold text-white">Show QR</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={handleShare}
              className="h-9 flex-1 rounded-2xl bg-secondary-hover border-0"
            >
              <Share2 size={18} color="white" />
              <Text className="font-bold text-white">Share</Text>
            </Button>
          </View>

          {shareError && (
            <Text className="text-xs text-muted-foreground">Sharing not supported.</Text>
          )}
        </View>
      </View>

      {/* Warning Text */}
      <View className="flex-row items-center justify-center gap-1.5 px-4 md:my-0 my-2">
        <Info size={16} color="#A1A1AA" />
        <Text className="text-[#A1A1AA] text-sm text-center">
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
        <View className="w-full rounded-2xl bg-accent">
          {priceRows.map((row, index) => (
            <View key={row.label}>
              <View className="flex-row items-center justify-between px-5 py-4 gap-1.5">
                <Text className="font-medium text-base text-muted-foreground">{row.label}</Text>
                <View className="flex-row items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`font-medium text-foreground text-base ${row.valueClassName ? row.valueClassName : ''}`}
                    >
                      {row.value}
                    </Text>
                  )}
                  {row.extra}
                </View>
              </View>
              {index !== priceRows.length - 1 && <View className="h-px bg-primary/10 ml-5" />}
            </View>
          ))}
        </View>
      )}

      {/* Details Info Rows */}
      {!isExpired && (
        <View className="w-full rounded-2xl bg-accent">
          {infoRows.map((row, index) => (
            <View key={row.label}>
              <View className="flex-row items-center justify-between px-5 py-4 gap-1.5">
                <View className="flex-row items-center gap-1.5">
                  {row.icon}
                  <Text className="font-medium text-base text-muted-foreground">{row.label}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`font-medium text-foreground ${row.valueClassName ? row.valueClassName : ''}`}
                    >
                      {row.value}
                    </Text>
                  )}
                  {row.extra}
                </View>
              </View>
              {index !== infoRows.length - 1 && <View className="h-px bg-primary/10 ml-5" />}
            </View>
          ))}
        </View>
      )}

      {/* Expired message */}
      {isExpired && (
        <View className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 items-center">
          <Text className="font-medium text-red-400 text-center">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      {/* Done button */}
      <Button onPress={handleDone} className="h-14 w-full rounded-2xl bg-[#94F27F] mt-2">
        <Text className="text-lg font-bold text-black">Done</Text>
      </Button>

      {/* Need help? */}
      <View className="items-center pb-4">
        <Button
          variant="ghost"
          className="flex-row items-center gap-2"
          onPress={() => intercom?.show()}
        >
          <MessageCircle size={18} color="#A1A1AA" />
          <Text className="text-[#A1A1AA] font-medium">Need help?</Text>
        </Button>
      </View>

      {/* QR Dialog */}
      <ResponsiveDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        title="Scan to deposit"
        contentClassName="px-3 py-4"
      >
        <View className="items-center gap-3">
          <View className="rounded-3xl bg-white p-3">
            <QRCode value={walletAddress || ''} size={220} backgroundColor="white" color="black" />
          </View>
          <Text className="text-center text-xs text-muted-foreground">
            Share this QR code with the sender or scan it from another device to populate the wallet
            address automatically.
          </Text>
        </View>
      </ResponsiveDialog>
    </View>
  );
};

export default DepositDirectlyAddress;
