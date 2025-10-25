import { Image } from 'expo-image';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDepositStore } from '@/store/useDepositStore';
import { useDirectDepositSessionPolling } from '@/hooks/useDirectDepositSession';
import { useTotalAPY } from '@/hooks/useAnalytics';
import { eclipseAddress } from '@/lib/utils';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import useUser from '@/hooks/useUser';
import { Fuel, QrCode, Share2 } from 'lucide-react-native';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { path } from '@/constants/path';

const USDC_ICON = require('@/assets/images/usdc.png');

const DepositDirectlyAddress = () => {
  const { user } = useUser();
  const { directDepositSession, setModal, clearDirectDepositSession } = useDepositStore();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'error' | null>(null);
  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY();

  // Poll for session status updates
  const { session } = useDirectDepositSessionPolling(directDepositSession.sessionId, true);

  // Track status changes
  useEffect(() => {
    if (session?.status === 'detected') {
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        status: 'detected',
      });
    } else if (session?.status === 'completed') {
      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        amount: session.detectedAmount,
        transaction_hash: session.transactionHash,
      });
    } else if (session?.status === 'failed') {
      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        status: 'failed',
      });
    }
  }, [
    session?.status,
    session?.sessionId,
    session?.detectedAmount,
    session?.transactionHash,
    user,
  ]);

  useEffect(() => {
    if (!shareFeedback) return;

    const timer = setTimeout(() => setShareFeedback(null), 2500);

    return () => clearTimeout(timer);
  }, [shareFeedback]);

  const handleDone = () => {
    setModal(DEPOSIT_MODAL.CLOSE);
    clearDirectDepositSession();
    router.push(path.ACTIVITY);
  };

  const handleShare = async () => {
    const address = directDepositSession.walletAddress;
    if (!address) return;

    try {
      await Share.share({
        message: address,
        title: 'Solid deposit address',
      });
    } catch (error) {
      console.error('Failed to share deposit address:', error);
      setShareFeedback('error');
    }
  };

  // Get network info
  const chainId = directDepositSession.chainId || 1;
  const network = BRIDGE_TOKENS[chainId];

  // Map status to display text
  const getStatusText = () => {
    switch (session?.status || directDepositSession.status) {
      case 'pending':
        return 'Waiting for transfer';
      case 'detected':
        return 'Transfer detected';
      case 'processing':
        return 'Processing deposit...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Session expired';
      default:
        return 'Waiting for transfer';
    }
  };

  const isCompleted =
    session?.status === 'completed' || directDepositSession.status === 'completed';
  const isExpired = session?.status === 'expired' || directDepositSession.status === 'expired';

  const statusToneClass = useMemo(() => {
    if (isCompleted) return 'text-[#5BFF6C]';
    if (isExpired || session?.status === 'failed' || directDepositSession.status === 'failed') {
      return 'text-red-400';
    }
    if (
      session?.status === 'processing' ||
      session?.status === 'detected' ||
      directDepositSession.status === 'processing'
    ) {
      return 'text-[#F9D270]';
    }
    return 'text-foreground';
  }, [directDepositSession.status, isCompleted, isExpired, session?.status]);

  // TODO: Calculate estimated time based on chainId
  const estimatedTime = chainId === 1 ? '5 minutes' : '30 minutes';

  type InfoRow = {
    label: string;
    value?: string;
    valueClassName?: string;
    extra?: ReactNode;
    icon?: ReactNode;
    valueContent?: ReactNode;
  };

  const formattedAPY = totalAPY !== undefined ? `${totalAPY.toFixed(2)}%` : '—';

  const infoRows: InfoRow[] = [
    {
      label: 'APY',
      valueClassName: 'text-[#5BFF6C] font-semibold text-lg',
      valueContent: isTotalAPYLoading ? (
        <Skeleton className="h-5 w-16 bg-white/20" />
      ) : (
        <Text className="font-semibold text-foreground text-[#5BFF6C] text-lg">{formattedAPY}</Text>
      ),
      extra: (
        <TooltipPopover
          text="Annual percentage yield for this deposited amount. Actual yield may vary slightly once the transfer clears."
          analyticsContext="deposit_directly_apy"
          side="top"
        />
      ),
    },
    {
      label: 'Min deposit',
      value: `< ${session?.minDeposit || directDepositSession.minDeposit || '0.0001'} USDC`,
    },
    {
      label: 'Max deposit',
      value: `${session?.maxDeposit || directDepositSession.maxDeposit || '500,000'} USDC`,
    },
    {
      label: 'Estimated time',
      value: estimatedTime,
    },
    {
      label: 'Status',
      value: getStatusText(),
      valueClassName: `${statusToneClass} font-semibold`,
    },
    {
      label: 'Fee',
      value: `${session?.fee || directDepositSession.fee || '2.3'} USDC`,
      icon: <Fuel size={16} color="#A1A1AA" />,
    },
  ];

  return (
    <View className="flex items-center gap-8 px-4 py-6">
      <View className="items-center gap-3">
        <View className="flex-row flex-wrap items-center justify-center gap-2">
          <Text className="text-lg text-[#ACACAC]">Transfer</Text>
          <View className="flex-row items-center gap-2 px-3 py-1.5">
            <Image source={USDC_ICON} style={{ width: 18, height: 18 }} contentFit="cover" />
            <Text className="text-sm font-semibold text-white">USDC</Text>
          </View>
          <Text className="text-lg font-semibold text-[#ACACAC]">to this</Text>
          <View className="flex-row items-center gap-2 px-3 py-1.5">
            <Image source={network?.icon} style={{ width: 18, height: 18 }} contentFit="contain" />
            <Text className="text-sm font-semibold text-[#ACACAC]">
              {network?.name || 'Ethereum'} address
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-center text-sm text-[#ACACAC]">
          Use the deposit details below to transfer USDC from any wallet or exchange.
        </Text>
      </View>

      <View className="w-full rounded-[20px] bg-card/95 p-6" style={{ maxWidth: 400 }}>
        <View className="gap-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-mono text-[1.05rem] tracking-wide text-foreground">
                {directDepositSession.walletAddress
                  ? eclipseAddress(directDepositSession.walletAddress, 6, 6)
                  : '—'}
              </Text>
            </View>
            <CopyToClipboard
              text={directDepositSession.walletAddress || ''}
              className="h-12 w-12 bg-transparent"
              iconClassName="text-white"
            />
          </View>

          <View className="flex-row gap-3">
            <Button
              onPress={() => setIsQrDialogOpen(true)}
              className="h-10 flex-1 rounded-[14px] bg-white/10"
            >
              <QrCode size={18} color="white" />
              <Text className="font-semibold text-white">Show QR</Text>
            </Button>
            <Button onPress={handleShare} className="h-10 flex-1 rounded-[14px] bg-white/10">
              <Share2 size={18} color="white" />
              <Text className="font-semibold text-white">Share</Text>
            </Button>
          </View>

          {shareFeedback && (
            <Text className="text-xs text-red-400">
              Sharing is unavailable right now. Please try again later.
            </Text>
          )}
        </View>
      </View>

      {!isExpired && (
        <View className="w-full rounded-[20px] bg-card/95 p-6" style={{ maxWidth: 400 }}>
          <View className="gap-4">
            {infoRows.map(row => (
              <View
                key={row.label}
                className="flex-row items-center justify-between gap-3 px-1 py-1.5"
              >
                <View className="flex-row items-center gap-2">
                  {row.icon}
                  <Text className="text-sm font-medium text-muted-foreground">{row.label}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {row.valueContent ? (
                    row.valueContent
                  ) : (
                    <Text
                      className={`text-sm font-medium text-foreground ${
                        row.valueClassName ? row.valueClassName : ''
                      }`}
                    >
                      {row.value}
                    </Text>
                  )}
                  {row.extra}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {isExpired && (
        <View
          className="w-full rounded-[32px] border border-red-500/20 bg-red-500/10 px-6 py-5"
          style={{ maxWidth: 400 }}
        >
          <Text className="text-center font-medium text-red-400">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      <Button
        onPress={handleDone}
        disabled={!isCompleted && !isExpired}
        className={`h-12 w-full rounded-full ${
          isCompleted || isExpired ? 'bg-[#52FF3F]' : 'bg-white/10'
        }`}
        style={{ maxWidth: 400 }}
      >
        <Text
          className={`text-base font-semibold ${
            isCompleted || isExpired ? 'text-black' : 'text-muted-foreground'
          }`}
        >
          Done
        </Text>
      </Button>

      <ResponsiveDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        title="Scan to deposit"
        contentClassName="px-6 py-8"
      >
        <View className="items-center gap-5">
          <View className="rounded-3xl bg-white p-5">
            <QRCode
              value={directDepositSession.walletAddress || ''}
              size={220}
              backgroundColor="white"
              color="black"
            />
          </View>
          <Text className="text-center text-sm text-muted-foreground">
            Share this QR code with the sender or scan it from another device to populate the wallet
            address automatically.
          </Text>
        </View>
      </ResponsiveDialog>
    </View>
  );
};

export default DepositDirectlyAddress;
