import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy, Fuel, Info, Share2 } from 'lucide-react-native';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import CopyToClipboard from '@/components/CopyToClipboard';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
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

const ICON_STYLE_24 = { width: 24, height: 24 };
const NETWORK_ICON_STYLE = { width: 24, height: 24, borderRadius: 12 };
const ICON_STYLE_18 = { width: 18, height: 18 };

const FUEL_ICON = <Fuel size={16} color="#A1A1AA" />;
const COPY_ICON = <Copy size={14} color="white" />;
const SHARE_ICON = <Share2 size={18} color="white" />;
const INFO_ICON = <Info size={16} color="#A1A1AA" />;

type InfoRowItemProps = {
  label: string;
  value?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
  valueContent?: React.ReactNode;
  extra?: React.ReactNode;
  showDivider: boolean;
};

const InfoRowItem = React.memo(function InfoRowItem({
  label,
  value,
  valueClassName,
  icon,
  valueContent,
  extra,
  showDivider,
}: InfoRowItemProps) {
  return (
    <View>
      <View className="flex-row items-start gap-4 px-5 py-4">
        <View className="flex-1 flex-row items-center gap-1.5 pr-2">
          {icon}
          <Text className="text-lg font-medium text-muted-foreground">{label}</Text>
        </View>
        <View className="min-w-0 flex-1 items-end gap-2">
          {valueContent ? (
            valueContent
          ) : (
            <Text
              className={`text-right font-medium text-muted-foreground ${valueClassName ?? ''}`}
            >
              {value}
            </Text>
          )}
          {extra}
        </View>
      </View>
      {showDivider && <View className="ml-5 h-px bg-primary/10" />}
    </View>
  );
});

type PriceRowItemProps = {
  label: string;
  value?: string;
  valueClassName?: string;
  valueContent?: React.ReactNode;
  showDivider: boolean;
};

const PriceRowItem = React.memo(function PriceRowItem({
  label,
  value,
  valueClassName,
  valueContent,
  showDivider,
}: PriceRowItemProps) {
  return (
    <View>
      <View className="flex-row items-start gap-4 px-5 py-4">
        <Text className="flex-1 text-lg font-medium text-muted-foreground">{label}</Text>
        <View className="min-w-0 flex-1 items-end gap-2">
          {valueContent ? (
            valueContent
          ) : (
            <Text
              className={`text-right text-lg font-medium text-foreground ${valueClassName ?? ''}`}
            >
              {value}
            </Text>
          )}
        </View>
      </View>
      {showDivider && <View className="ml-5 h-px bg-primary/10" />}
    </View>
  );
});

type DepositHeaderProps = {
  tokenIcon: any;
  selectedToken: string;
  networkIcon: any;
  networkName: string;
};

const DepositHeader = React.memo(function DepositHeader({
  tokenIcon,
  selectedToken,
  networkIcon,
  networkName,
}: DepositHeaderProps) {
  return (
    <View className="flex-row flex-wrap items-center justify-center">
      <Text className="text-2xl font-bold text-[#ACACAC]">Transfer</Text>
      <View className="flex-row items-center gap-1 px-1">
        <Image source={tokenIcon} style={ICON_STYLE_24} contentFit="cover" />
        <Text className="text-2xl font-bold text-white">{selectedToken}</Text>
      </View>
      <Text className="text-2xl font-semibold text-[#ACACAC]">to this</Text>
      <View className="flex-row items-center gap-1 px-2">
        <Image source={networkIcon} style={NETWORK_ICON_STYLE} contentFit="cover" />
        <Text className="text-2xl font-semibold text-[#ACACAC]">{networkName} address</Text>
      </View>
    </View>
  );
});

type AddressCardProps = {
  walletAddress: string | undefined;
  handleCopy: () => void;
  handleQrOpen: () => void;
  handleShare: () => void;
  shareError: boolean;
};

const AddressCard = React.memo(function AddressCard({
  walletAddress,
  handleCopy,
  handleQrOpen,
  handleShare,
  shareError,
}: AddressCardProps) {
  return (
    <View className="mt-2 w-full rounded-[20px] bg-card p-4">
      <View className="gap-4">
        <View className="flex-row items-center justify-center">
          <Text className="text-center text-lg tracking-wide text-foreground">
            {walletAddress ? eclipseAddress(walletAddress, 6, 6) : '—'}
          </Text>
          <CopyToClipboard
            text={walletAddress || ''}
            className="h-10 w-10 bg-transparent"
            iconClassName="text-white"
            onCopy={handleCopy}
          />
        </View>

        <View className="flex-row gap-4 pb-1">
          <Button
            variant="secondary"
            onPress={handleQrOpen}
            className="h-9 flex-1 rounded-2xl border-0 bg-secondary"
          >
            {COPY_ICON}
            <Text className="font-bold text-white">Show QR</Text>
          </Button>
          <Button
            variant="secondary"
            onPress={handleShare}
            className="h-9 flex-1 rounded-2xl border-0 bg-secondary"
          >
            {SHARE_ICON}
            <Text className="font-bold text-white">Share</Text>
          </Button>
        </View>

        {shareError && (
          <Text className="text-xs text-muted-foreground">Sharing not supported.</Text>
        )}
      </View>
    </View>
  );
});

type WarningBannerProps = {
  selectedToken: string;
};

const WarningBanner = React.memo(function WarningBanner({ selectedToken }: WarningBannerProps) {
  return (
    <View className="my-2 flex-row items-center justify-center gap-1.5 px-4 md:my-0">
      {INFO_ICON}
      <Text
        className="min-w-0 shrink text-center text-sm text-[#A1A1AA]"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        Please send only {selectedToken} to this address
      </Text>
      <TooltipPopover
        text="Sending any other token may result in permanent loss of funds."
        analyticsContext="deposit_directly_warning"
        side="top"
      />
    </View>
  );
});

type QRDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | undefined;
};

const QRDialog = React.memo(function QRDialog({
  isOpen,
  onOpenChange,
  walletAddress,
}: QRDialogProps) {
  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title="Scan to deposit"
      mobilePlacement="center"
      contentClassName="max-w-sm px-3 py-4"
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
  );
});

const DepositDirectlyAddress = () => {
  const insets = useSafeAreaInsets();

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
  const [shareError, setShareError] = useState(false);
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

  useEffect(() => {
    if (!shareError) return;
    const timer = setTimeout(() => setShareError(false), 2500);
    return () => clearTimeout(timer);
  }, [shareError]);

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

  const handleShare = useCallback(async () => {
    if (!walletAddress) return;

    try {
      await Share.share({ message: walletAddress, title: 'Solid deposit address' });

      track(TRACKING_EVENTS.DEPOSIT_DIRECT_ADDRESS_SHARED, {
        deposit_method: 'deposit_directly',
        session_id: sessionId,
        chain_id: chainId,
        selected_token: selectedToken,
      });
    } catch (error) {
      console.error('Failed to share deposit address:', error);
      setShareError(true);
    }
  }, [walletAddress, chainId, selectedToken, sessionId]);

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

  const minDeposit = EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT || rawMinDeposit || '0.0001';
  const fee = rawFee || '0';

  const networkName = network?.name || 'Ethereum';
  const networkIcon = network?.icon;

  const youWillReceiveContent = useMemo(() => {
    const usdcAmount = 10;
    const soUSDAmount = exchangeRate
      ? usdcAmount / Number(formatUnits(exchangeRate, 6))
      : usdcAmount;

    return (
      <View className="min-w-0 max-w-full flex-row items-start justify-end gap-1.5">
        <Image source={SOUSD_ICON} style={ICON_STYLE_18} contentFit="cover" />
        <View className="min-w-0 flex-1">
          <Text className="text-right text-lg font-bold text-white">
            {formatNumber(soUSDAmount, 2, 2)} soUSD
          </Text>
          <Text className="text-right text-sm text-white/70">on Ethereum</Text>
        </View>
      </View>
    );
  }, [exchangeRate]);

  const priceContent = useMemo(
    () => (
      <Text className="shrink text-right text-lg font-bold text-white">
        1 soUSD = {formatNumber(exchangeRate ? Number(formatUnits(exchangeRate, 6)) : 1, 4, 4)}{' '}
        {selectedToken}
      </Text>
    ),
    [exchangeRate, selectedToken],
  );

  const apyContent = useMemo(
    () =>
      isAPYsLoading ? (
        <Skeleton className="h-7 w-16 bg-white/20" />
      ) : (
        <Text className="text-right text-lg font-bold text-[#94F27F]">{formattedAPY}</Text>
      ),
    [isAPYsLoading, formattedAPY],
  );

  const statusValue = STATUS_TEXT[status];
  const statusClassName = `${STATUS_TONE_CLASSES[status]} font-medium`;
  const minDepositValue = `${minDeposit} ${selectedToken}`;
  const feeValue = `${fee} ${selectedToken}`;

  return (
    <View className="flex-col gap-3" style={{ paddingBottom: insets.bottom }}>
      <DepositHeader
        tokenIcon={tokenIcon}
        selectedToken={selectedToken}
        networkIcon={networkIcon}
        networkName={networkName}
      />

      <AddressCard
        walletAddress={walletAddress}
        handleCopy={handleCopy}
        handleQrOpen={handleQrOpen}
        handleShare={handleShare}
        shareError={shareError}
      />

      <WarningBanner selectedToken={selectedToken} />

      {!isExpired && (
        <View className="w-full rounded-2xl bg-card">
          <PriceRowItem label="You will receive" valueContent={youWillReceiveContent} showDivider />
          <PriceRowItem label="Price" valueContent={priceContent} showDivider />
          <PriceRowItem label="APY" valueContent={apyContent} showDivider={false} />
        </View>
      )}

      {!isExpired && (
        <View className="w-full rounded-2xl bg-card">
          <InfoRowItem label="Min deposit" value={minDepositValue} showDivider />
          <InfoRowItem label="Estimated time" value={estimatedTime} showDivider />
          <InfoRowItem
            label="Status"
            value={statusValue}
            valueClassName={statusClassName}
            showDivider
          />
          <InfoRowItem label="Fee" value={feeValue} icon={FUEL_ICON} showDivider={false} />
        </View>
      )}

      {isExpired && (
        <View className="w-full items-center rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3">
          <Text className="text-center font-medium text-red-400">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      <Button onPress={handleDone} className="mt-2 h-14 w-full rounded-2xl bg-[#94F27F]">
        <Text className="text-base font-bold text-black">Done</Text>
      </Button>

      <View className="items-center pb-4">
        <NeedHelp />
      </View>

      {isQrDialogOpen && (
        <QRDialog
          isOpen={isQrDialogOpen}
          onOpenChange={setIsQrDialogOpen}
          walletAddress={walletAddress}
        />
      )}
    </View>
  );
};

export default DepositDirectlyAddress;
