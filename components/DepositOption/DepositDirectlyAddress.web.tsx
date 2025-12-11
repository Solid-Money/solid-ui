import CopyToClipboard from '@/components/CopyToClipboard';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useDirectDepositSessionPolling } from '@/hooks/useDirectDepositSession';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { eclipseAddress, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy, Fuel, Info, MessageCircle, Share2 } from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatUnits } from 'viem';

const USDC_ICON = require('@/assets/images/usdc.png');

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
  const chainId = directDepositSession.chainId || 1;
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'error' | null>(null);
  const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
  const { exchangeRate } = usePreviewDeposit(
    '10',
    BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address,
    chainId,
  );
  const trackedStatuses = useRef<Set<DepositStatus>>(new Set());

  const { session } = useDirectDepositSessionPolling(directDepositSession.sessionId, true);

  const network = BRIDGE_TOKENS[chainId];
  const walletAddress = directDepositSession.walletAddress;

  // Unified status from polling or store
  const status: DepositStatus =
    (session?.status as DepositStatus) || directDepositSession.status || 'pending';
  const isExpired = status === 'expired';

  // Track status changes (only once per status)
  useEffect(() => {
    if (!session?.sessionId || trackedStatuses.current.has(status)) return;
    trackedStatuses.current.add(status);

    const basePayload = {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      session_id: session.sessionId,
    };

    switch (status) {
      case 'detected':
        track(TRACKING_EVENTS.DEPOSIT_VALIDATED, { ...basePayload, status: 'detected' });
        break;
      case 'completed':
        track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
          ...basePayload,
          amount: session.detectedAmount,
          transaction_hash: session.transactionHash,
        });
        break;
      case 'failed':
        track(TRACKING_EVENTS.DEPOSIT_ERROR, { ...basePayload, status: 'failed' });
        break;
    }
  }, [status, session, user?.userId, user?.safeAddress]);

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
    EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT ||
    session?.minDeposit ||
    directDepositSession.minDeposit ||
    '0.0001';
  const fee = session?.fee || directDepositSession.fee || '0';

  const infoRows: InfoRow[] = useMemo(
    () => [
      { label: 'Min deposit', value: `${minDeposit} USDC` },
      { label: 'Estimated time', value: estimatedTime },
      {
        label: 'Status',
        value: STATUS_TEXT[status],
        valueClassName: `${STATUS_TONE_CLASSES[status]} font-medium`,
      },
      { label: 'Fee', value: `${fee} USDC`, icon: <Fuel size={16} color="#A1A1AA" /> },
    ],
    [minDeposit, estimatedTime, status, fee],
  );

  const priceRows: InfoRow[] = useMemo(() => {
    const rows: InfoRow[] = [];

    rows.push({
      label: 'Price',
      valueContent: (
        <Text className="font-medium text-white text-base">
          1 soUSD = {formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 1, 4, 4)}{' '}
          USDC
        </Text>
      ),
    });

    rows.push({
      label: 'APY',
      valueContent: isMaxAPYsLoading ? (
        <Skeleton className="h-7 w-16 bg-white/20" />
      ) : (
        <Text className="font-medium text-[#94F27F] text-base">{formattedAPY}</Text>
      ),
    });

    return rows;
  }, [exchangeRate, isMaxAPYsLoading, formattedAPY]);

  return (
    <View className="flex flex-col gap-3 md:gap-4 2xl:gap-6">
      <View className="flex flex-row flex-wrap items-center justify-center">
        <Text className="text-xl md:text-2xl font-bold text-[#ACACAC]">Transfer</Text>
        <View className="flex flex-row items-center gap-1 px-1">
          <Image
            source={USDC_ICON}
            style={{ width: 21, height: 21 }}
            contentFit="cover"
          />
          <Text className="text-xl md:text-2xl font-bold text-white">USDC</Text>
        </View>
        <Text className="text-xl md:text-2xl font-semibold text-[#ACACAC]">to this</Text>
        <View className="flex flex-row items-center gap-1 px-2 2xl:px-3">
          {network?.icon && (
            <Image
              source={typeof network.icon === 'string' ? { uri: network.icon } : network.icon}
              style={{ width: 21, height: 21, borderRadius: 9 }}
              contentFit="cover"
              accessibilityLabel={network?.name}
            />
          )}
          <Text className="text-xl md:text-2xl font-semibold text-[#ACACAC]">
            <Text className="text-white">{network?.name || 'Ethereum'}</Text>{' '}
            <Text className="text-[#ACACAC]">address</Text>
          </Text>
        </View>
      </View>

      <View className="w-full rounded-[20px] bg-primary/10 mt-2 p-4 md:py-4 md:px-6">
        <View className="flex flex-col gap-4">
          <View className="flex flex-row items-center justify-center">
            <Text className="text-lg tracking-wide text-foreground text-center font-semibold">
              {walletAddress ? eclipseAddress(walletAddress, 6, 6) : '—'}
            </Text>
            <CopyToClipboard
              text={walletAddress || ''}
              className="h-10 w-10 md:h-12 md:w-12 bg-transparent web:hover:bg-transparent web:active:bg-transparent"
              iconClassName="text-white"
            />
          </View>

          <View className="grid grid-cols-2 gap-4 pb-1">
            <Button
              variant="secondary"
              onPress={() => setIsQrDialogOpen(true)}
              className="h-9 rounded-2xl bg-secondary-hover web:hover:brightness-110 border-0"
            >
              <Copy size={14} color="white" />
              <Text className="md:text-lg font-bold text-white text-[1rem]">Show QR</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={handleShare}
              className="h-9 rounded-2xl bg-secondary-hover web:hover:brightness-110 border-0"
            >
              <Share2 size={18} color="white" />
              <Text className="md:text-lg font-bold text-white text-[1rem]">Share</Text>
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
        <Text className="text-[#A1A1AA] text-sm text-center md:my-0 my-2">
          Please send only USDC to this address
        </Text>
        <TooltipPopover
          text="Sending any other token may result in permanent loss of funds."
          analyticsContext="deposit_directly_warning"
          side="top"
        />
      </View>

      {/* Yield Info Rows */}
      {!isExpired && (
        <View className="w-full rounded-2xl bg-accent flex flex-col">
          {priceRows.map((row, index) => (
            <View key={row.label} className="flex flex-col">
              <View className="flex flex-row items-center justify-between px-5 py-4 md:px-6 gap-1.5 md:gap-2 2xl:gap-3">
                <Text className="font-medium text-base text-muted-foreground">{row.label}</Text>
                <View className="flex items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`font-medium text-foreground ${
                        row.valueClassName ? row.valueClassName : ''
                      }`}
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
        <View className="w-full rounded-2xl bg-primary/10 flex flex-col">
          {infoRows.map((row, index) => (
            <View key={row.label} className="flex flex-col">
              <View className="flex flex-row items-center justify-between px-5 py-4 md:px-6 gap-1.5 md:gap-2 2xl:gap-3">
                <View className="flex items-center gap-1.5 md:gap-2">
                  {row.icon}
                  <Text className="font-medium text-primary/70 text-[1rem]">{row.label}</Text>
                </View>
                <View className="flex items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`font-medium text-foreground text-[1rem] ${
                        row.valueClassName ? row.valueClassName : ''
                      }`}
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

      {isExpired && (
        <View className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-3 md:px-4 2xl:px-6 py-3 md:py-4 2xl:py-5 text-center">
          <Text className="font-medium text-base text-red-400">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      <Button
        onPress={handleDone}
        className="h-14 w-full rounded-2xl bg-[#94F27F] web:hover:bg-[#94F27F]/90 mt-2"
      >
        <Text className="text-lg font-bold text-black">Done</Text>
      </Button>

      {/* Need help? */}
      <View className="flex items-center justify-center pb-4">
        <Button
          variant="ghost"
          className="flex flex-row items-center gap-2 hover:bg-transparent"
          onPress={() => window.open('https://intercom.help/solid-money/en', '_blank')}
        >
          <MessageCircle size={18} color="#A1A1AA" />
          <Text className="text-[#A1A1AA] font-medium">Need help?</Text>
        </Button>
      </View>

      <ResponsiveDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        title="Scan to deposit"
        contentClassName="px-3 md:px-4 2xl:px-6 py-4 md:py-6 2xl:py-8"
      >
        <View className="flex flex-col items-center gap-3 md:gap-4 2xl:gap-5">
          <View className="rounded-3xl bg-white p-3 md:p-4 2xl:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
            <QRCode value={walletAddress || ''} size={220} backgroundColor="white" color="black" />
          </View>
          <Text className="text-center text-xs md:text-sm text-muted-foreground">
            Share this QR code with the sender or scan it from another device to populate the wallet
            address automatically.
          </Text>
        </View>
      </ResponsiveDialog>
    </View>
  );
};

export default DepositDirectlyAddress;
