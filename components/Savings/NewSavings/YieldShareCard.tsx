import { Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, CreditCard } from 'lucide-react-native';

import YieldIcon from '@/components/Earn/YieldIcon';
import {
  formatShareRate,
  formatYieldUsd,
  yieldProductName,
  yieldVault,
} from '@/components/Earn/yieldProducts';
import { Text } from '@/components/ui/text';
import { formatTokenAmount } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';

const ShareRow = ({
  icon,
  title,
  subtitle,
  value,
  detail,
  accessibilityLabel,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) => {
  const content = (
    <>
      {icon}
      <View className="min-w-0 flex-1 gap-[3px]">
        <Text className="text-[16px] font-semibold leading-5 text-white" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[14px] leading-5 text-white/60" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View className="shrink-0 items-end gap-[3px]">
        <Text className="text-[16px] font-semibold leading-5 text-white">{value}</Text>
        <Text className="text-[14px] leading-5 text-white/60">{detail}</Text>
      </View>
      {onPress ? <ChevronRight size={16} strokeWidth={1.6} color="rgba(255,255,255,0.35)" /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-[14px] active:bg-white/5"
    >
      {content}
    </Pressable>
  ) : (
    <View className="flex-row items-center gap-3 px-4 py-[14px]">{content}</View>
  );
};

interface YieldShareCardProps {
  vaultType: VaultType;
  walletShares: number;
  walletUsd: number | undefined;
  escrowedShares: number;
  escrowedUsd: number | undefined;
  debtUsd: number | undefined;
  /** Native units per share, for the "1 soUSD = $1.0830" line. */
  exchangeRate: number | undefined;
  onOpenWallet?: () => void;
  onOpenCredit?: () => void;
}

/**
 * Figma 28443:4811 "Your soUSD": the share token behind the product, split by where it is.
 * Shares backing the card only appear once a credit purchase has locked some.
 */
const YieldShareCard = ({
  vaultType,
  walletShares,
  walletUsd,
  escrowedShares,
  escrowedUsd,
  debtUsd,
  exchangeRate,
  onOpenWallet,
  onOpenCredit,
}: YieldShareCardProps) => {
  const token = yieldVault(vaultType).vaultToken;
  const product = yieldProductName(vaultType);
  const rate = formatShareRate(vaultType, exchangeRate);
  const rows: { key: string; row: ReactNode }[] = [];
  if (walletShares > 0)
    rows.push({
      key: 'wallet',
      row: (
        <ShareRow
          icon={<YieldIcon vaultType={vaultType} badge="live" />}
          title={token}
          subtitle={`${formatTokenAmount(walletShares)} ${token}`}
          value={formatYieldUsd(walletUsd)}
          detail="In your wallet"
          accessibilityLabel={`Open ${token}`}
          onPress={onOpenWallet}
        />
      ),
    });
  if (escrowedShares > 0)
    rows.push({
      key: 'credit',
      row: (
        <ShareRow
          icon={
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <CreditCard size={20} strokeWidth={1.75} color="#ffffff" />
            </View>
          }
          title="Backing your card"
          subtitle={`${formatTokenAmount(escrowedShares)} ${token}`}
          value={formatYieldUsd(escrowedUsd)}
          detail={
            debtUsd !== undefined && debtUsd > 0
              ? `${formatYieldUsd(debtUsd).replace(/\.00$/, '')} borrowed`
              : 'Credit collateral'
          }
          accessibilityLabel="Open your credit position"
          onPress={onOpenCredit}
        />
      ),
    });
  if (!rows.length) return null;

  return (
    <View className="gap-3">
      <Text className="text-[16px] leading-5 text-white/50">Your {token}</Text>
      <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
        {rows.map(({ key, row }, index) => (
          <Fragment key={key}>
            {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
            {row}
          </Fragment>
        ))}
      </View>
      <Text className="text-[13px] leading-[18px] text-white/50">
        {token} is the token you hold for {product}. The number of {token} stays the same; each one
        becomes worth more as interest is added.{rate ? ` ${rate}.` : ''}
      </Text>
    </View>
  );
};

export default YieldShareCard;
