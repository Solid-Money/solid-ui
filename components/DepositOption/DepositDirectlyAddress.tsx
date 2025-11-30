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
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import { eclipseAddress } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy, Fuel, Share2 } from 'lucide-react-native';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { mainnet } from 'viem/chains';

const USDC_ICON = require('@/assets/images/usdc.png');

const STATUS_TEXT: Record<string, string> = {
  pending: 'Waiting for transfer',
  detected: 'Transfer detected',
  processing: 'Processing deposit...',
  completed: 'Completed',
  failed: 'Failed',
  expired: 'Session expired',
};

type DepositStatus = 'pending' | 'detected' | 'processing' | 'completed' | 'failed' | 'expired';

const DepositDirectlyAddress = () => {
  const { user } = useUser();
  const { directDepositSession, setModal, clearDirectDepositSession } = useDepositStore();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'error' | null>(null);
  const { maxAPY, isAPYsLoading } = useMaxAPY();
  const trackedStatuses = useRef<Set<string>>(new Set());

  const { session } = useDirectDepositSessionPolling(directDepositSession.sessionId, true);

  // Unified status from polling or store
  const status: DepositStatus =
    (session?.status as DepositStatus) || directDepositSession.status || 'pending';
  const isCompleted = status === 'completed';
  const isExpired = status === 'expired';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing' || status === 'detected';

  // Track status changes (only once per status)
  useEffect(() => {
    if (!session?.sessionId || trackedStatuses.current.has(status)) return;
    trackedStatuses.current.add(status);

    const basePayload = {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      session_id: session.sessionId,
    };

    if (status === 'detected') {
      track(TRACKING_EVENTS.DEPOSIT_VALIDATED, { ...basePayload, status: 'detected' });
    } else if (status === 'completed') {
      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        ...basePayload,
        amount: session.detectedAmount,
        transaction_hash: session.transactionHash,
      });
    } else if (status === 'failed') {
      track(TRACKING_EVENTS.DEPOSIT_ERROR, { ...basePayload, status: 'failed' });
    }
  }, [status, session, user?.userId, user?.safeAddress]);

  // Clear share feedback after timeout
  useEffect(() => {
    if (!shareFeedback) return;
    const timer = setTimeout(() => setShareFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [shareFeedback]);

  const handleDone = () => {
    setModal(DEPOSIT_MODAL.CLOSE);
    clearDirectDepositSession();
    if (!directDepositSession.fromActivity) {
      router.push(path.ACTIVITY);
    }
  };

  const handleShare = async () => {
    const address = directDepositSession.walletAddress;
    if (!address) return;

    try {
      await Share.share({ message: address, title: 'Solid deposit address' });
    } catch (error) {
      console.error('Failed to share deposit address:', error);
      setShareFeedback('error');
    }
  };

  const chainId = directDepositSession.chainId || mainnet.id;
  const network = BRIDGE_TOKENS[chainId];

  const statusToneClass = useMemo(() => {
    if (isCompleted) return 'text-[#5BFF6C]';
    if (isExpired || isFailed) return 'text-red-400';
    if (isProcessing) return 'text-[#F9D270]';
    return 'text-foreground';
  }, [isCompleted, isExpired, isFailed, isProcessing]);

  const estimatedTime = chainId === 1 ? '5 minutes' : '30 minutes';
  const formattedAPY = maxAPY !== undefined ? `${maxAPY.toFixed(2)}%` : '—';
  const minDeposit =
    EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT ||
    session?.minDeposit ||
    directDepositSession.minDeposit ||
    '0.0001';
  const maxDeposit = session?.maxDeposit || directDepositSession.maxDeposit || '500000';
  const fee = session?.fee || directDepositSession.fee || '0';

  type InfoRow = {
    label: string;
    value?: string;
    valueClassName?: string;
    extra?: ReactNode;
    icon?: ReactNode;
    valueContent?: ReactNode;
  };

  const infoRows: InfoRow[] = [
    {
      label: 'APY',
      valueContent: isAPYsLoading ? (
        <Skeleton className="h-7 w-16 bg-white/20" />
      ) : (
        <Text className="font-bold text-[#94F27F] text-xl">{formattedAPY}</Text>
      ),
      extra: (
        <TooltipPopover
          text="Annual percentage yield for this deposited amount. Actual yield may vary slightly once the transfer clears."
          analyticsContext="deposit_directly_apy"
          side="top"
        />
      ),
    },
    { label: 'Min deposit', value: `${minDeposit} USDC` },
    { label: 'Max deposit', value: `${maxDeposit} USDC` },
    { label: 'Estimated time', value: estimatedTime },
    {
      label: 'Status',
      value: STATUS_TEXT[status] || STATUS_TEXT.pending,
      valueClassName: `${statusToneClass} font-medium`,
    },
    { label: 'Fee', value: `${fee} USDC`, icon: <Fuel size={16} color="#A1A1AA" /> },
  ];

  return (
    <View className="flex-col gap-3">
      {/* Header - Transfer USDC to this address */}
      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-xl font-bold text-[#ACACAC]">Transfer</Text>
        <View className="flex-row items-center gap-1 px-1">
          <Image source={USDC_ICON} style={{ width: 21, height: 21 }} contentFit="cover" />
          <Text className="text-xl font-bold text-white">USDC</Text>
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
              {directDepositSession.walletAddress
                ? eclipseAddress(directDepositSession.walletAddress, 6, 6)
                : '—'}
            </Text>
            <CopyToClipboard
              text={directDepositSession.walletAddress || ''}
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

          {shareFeedback && (
            <Text className="text-xs text-muted-foreground">
              {shareFeedback === 'copied'
                ? 'Address copied to clipboard.'
                : 'Sharing not supported.'}
            </Text>
          )}
        </View>
      </View>

      {/* Info rows */}
      {!isExpired && (
        <View className="w-full rounded-2xl bg-accent">
          {infoRows.map((row, index) => (
            <View key={row.label}>
              <View className="flex-row items-center justify-between px-5 py-6 gap-1.5">
                <View className="flex-row items-center gap-1.5">
                  {row.icon}
                  <Text className="font-medium text-muted-foreground">{row.label}</Text>
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
              {index !== infoRows.length - 1 && <View className="h-px bg-primary/10" />}
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
      <Button onPress={handleDone} className="h-14 w-full rounded-2xl bg-[#94F27F]">
        <Text className="text-lg font-bold text-black">Done</Text>
      </Button>

      {/* QR Dialog */}
      <ResponsiveDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        title="Scan to deposit"
        contentClassName="px-3 py-4"
      >
        <View className="items-center gap-3">
          <View className="rounded-3xl bg-white p-3">
            <QRCode
              value={directDepositSession.walletAddress || ''}
              size={220}
              backgroundColor="white"
              color="black"
            />
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
