import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Copy, Fuel, Info, Share2 } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import {
  ICON_STYLE_18,
  ICON_STYLE_24,
  InfoRowItemProps,
  NETWORK_ICON_STYLE,
  PriceRowItemProps,
  SOUSD_ICON,
  useDepositDirectlyData,
} from '@/components/DepositOption/DepositDirectlyAddress.shared';
import NeedHelp from '@/components/NeedHelp';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { eclipseAddress } from '@/lib/utils';

const solidLogo = require('@/assets/images/solid-logo-4x.png');

const FUEL_ICON = <Fuel size={16} color="#A1A1AA" />;
const COPY_ICON = <Copy size={14} color="white" />;
const SHARE_ICON = <Share2 size={18} color="white" />;
const INFO_ICON = <Info size={16} color="#A1A1AA" />;

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
          <QRCode
            value={walletAddress || ''}
            size={220}
            logo={solidLogo}
            logoSize={55}
            logoBackgroundColor="#1C1C1C"
            logoBorderRadius={28}
          />
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
  const [shareError, setShareError] = useState(false);

  const {
    walletAddress,
    chainId,
    selectedToken,
    sessionId,
    tokenIcon,
    networkName,
    networkIcon,
    estimatedTime,
    formattedAPY,
    formattedExchangeRate,
    formattedSoUSDAmount,
    minDepositValue,
    feeValue,
    statusValue,
    statusClassName,
    isExpired,
    isAPYsLoading,
    isQrDialogOpen,
    setIsQrDialogOpen,
    handleDone,
    handleCopy,
    handleQrOpen,
  } = useDepositDirectlyData();

  useEffect(() => {
    if (!shareError) return;
    const timer = setTimeout(() => setShareError(false), 2500);
    return () => clearTimeout(timer);
  }, [shareError]);

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

  const youWillReceiveContent = useMemo(
    () => (
      <View className="min-w-0 max-w-full flex-row items-start justify-end gap-1.5">
        <Image source={SOUSD_ICON} style={ICON_STYLE_18} contentFit="cover" />
        <View className="min-w-0 flex-1">
          <Text className="text-right text-lg font-bold text-white">
            {formattedSoUSDAmount} soUSD
          </Text>
          <Text className="text-right text-sm text-white/70">on Ethereum</Text>
        </View>
      </View>
    ),
    [formattedSoUSDAmount],
  );

  const priceContent = useMemo(
    () => (
      <Text className="shrink text-right text-lg font-bold text-white">
        1 soUSD = {formattedExchangeRate} {selectedToken}
      </Text>
    ),
    [formattedExchangeRate, selectedToken],
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

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-col gap-3">
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
            <PriceRowItem
              label="You will receive"
              valueContent={youWillReceiveContent}
              showDivider
            />
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
    </ScrollView>
  );
};

export default DepositDirectlyAddress;
