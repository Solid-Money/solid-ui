import React, { useCallback, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useReferralSummary } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ReferralRewardListItem, ReferralRewardStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const REFERRAL_BASE_URL = 'https://www.solid.xyz/refer?ref=';

const STATUS_LABEL: Record<ReferralRewardStatus, string> = {
  [ReferralRewardStatus.PENDING]: 'In progress',
  [ReferralRewardStatus.QUALIFIED]: 'Qualified',
  [ReferralRewardStatus.PAID]: 'Rewarded',
  [ReferralRewardStatus.EXPIRED]: 'Expired',
  [ReferralRewardStatus.REVERSED]: 'Reversed',
  [ReferralRewardStatus.UNDER_REVIEW]: 'In review',
};

const formatUsd = (value: number) =>
  `$${(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Whole-dollar formatting (no decimals) for the program copy, e.g. "$15". */
const formatUsdWhole = (value: number) => `$${Math.round(value || 0).toLocaleString('en-US')}`;

function InfoRow({
  icon,
  center,
  children,
}: {
  icon: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className={cn('flex-row gap-3', center ? 'items-center' : 'items-start')}>
      <Image
        source={getAsset(icon as any)}
        style={{ width: 34, height: 34 }}
        contentFit="contain"
      />
      <Text className={cn('flex-1 text-base leading-5 text-white')}>
        {children}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 rounded-twice bg-card p-4 web:transition-colors web:hover:bg-card/70"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</Text>
        {onPress ? <ChevronRight size={16} color="rgba(255,255,255,0.5)" /> : null}
      </View>
      <Text className="mt-2 text-2xl font-bold text-white">{value}</Text>
    </Pressable>
  );
}

function ReferralListItem({ item }: { item: ReferralRewardListItem }) {
  const rewarded = item.status === ReferralRewardStatus.PAID;
  return (
    <View className="flex-row items-center justify-between border-t border-white/5 py-3">
      <View>
        <Text className="text-sm font-medium text-white">{STATUS_LABEL[item.status]}</Text>
        <Text className="text-xs text-white/50">
          {formatUsd(item.spendUsd)} spent · {item.merchantCount} merchant
          {item.merchantCount === 1 ? '' : 's'}
        </Text>
      </View>
      {rewarded ? (
        <Text className="text-sm font-semibold text-rewards">+{formatUsd(item.rewardUsd)}</Text>
      ) : null}
    </View>
  );
}

interface ReferralProgramContentProps {
  /**
   * When provided, the view is being shown inside a modal: the header close
   * button and any in-content navigation dismiss the modal first. When omitted
   * (route usage) the header close falls back to router back/replace.
   */
  onClose?: () => void;
}

export default function ReferralProgramContent({ onClose }: ReferralProgramContentProps) {
  const { user } = useUser();
  const { data: summary } = useReferralSummary();
  const [showFriends, setShowFriends] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const referralCode = user?.referralCode ?? '';
  const referralLink = `${REFERRAL_BASE_URL}${referralCode}`;

  const referrerUsd = summary?.rewards.referrerUsd ?? 15;
  const newUserUsd = summary?.rewards.newUserUsd ?? 10;
  const spendTarget = summary?.qualification.spendTargetUsd ?? 75;
  const merchantTarget = summary?.qualification.merchantTarget ?? 3;
  const windowDays = summary?.qualification.windowDays ?? 30;
  const hasActiveCard = summary?.hasActiveCard ?? false;
  const referrals = summary?.referrals ?? [];

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(path.REWARDS);
  }, [onClose]);

  const handleInvite = useCallback(async () => {
    const message = `Join me on Solid — order a card, spend, and we both earn. Use my link: ${referralLink}`;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : undefined;
        if (nav?.share) {
          await nav.share({ title: 'Join me on Solid', text: message, url: referralLink });
          return;
        }
        await nav?.clipboard?.writeText(referralLink);
        return;
      }
      await Share.share({ message, url: referralLink, title: 'Join me on Solid' });
    } catch (error) {
      console.error('Failed to share referral link:', error);
    }
  }, [referralLink]);

  return (
    <View className="mx-auto w-full max-w-lg flex-1 gap-6 px-4 py-6">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="w-10" />
        <Text className="text-center text-lg font-semibold text-white md:text-xl">
          Referral Program
        </Text>
        <Pressable
          onPress={handleClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted"
        >
          <X size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Hero */}
      <View className="items-center">
        <Image source={getAsset('images/referral-3d.png')} style={{ width: 120, height: 120 }} />
        <Text className="mt-3 text-center text-3xl font-bold leading-9 text-white">
          Invite friends &{'\n'}Earn together
        </Text>
      </View>

      {/* How it works */}
      <View className="relative gap-4 overflow-hidden rounded-twice bg-card p-5">
        <LinearGradient
          colors={['rgba(255, 209, 81, 1)', 'rgba(255, 209, 81, 0.4)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: -1,
            opacity: 0.15,
            borderRadius: 20,
          }}
        />
        <InfoRow icon="images/card-yellow-background.png" center>
          Have a Solid card issued.
        </InfoRow>
        <InfoRow icon="images/share-yellow-background.png" center>
          Share your referral link.
        </InfoRow>
        <InfoRow icon="images/wallet-yellow-background.png">
          Earn {formatUsdWhole(referrerUsd)} for you and {formatUsdWhole(newUserUsd)} for them
          when they order a card and spend {formatUsdWhole(spendTarget)} across {merchantTarget}+
          payments at different merchants within {windowDays} days.
        </InfoRow>
        <Text className="text-xs leading-4 text-white/50">
          Qualified spend excludes reversed or charged-back transactions.
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3">
        <StatCard label="Total rewarded" value={formatUsd(summary?.totalRewardedUsd ?? 0)} />
        <StatCard
          label="Friends invited"
          value={`${summary?.friendsInvited ?? 0}`}
          onPress={referrals.length ? () => setShowFriends(prev => !prev) : undefined}
        />
      </View>

      {showFriends && referrals.length > 0 && (
        <View className="rounded-twice bg-card px-5 py-2">
          {referrals.map((item, index) => (
            <ReferralListItem key={`${item.signupAt}-${index}`} item={item} />
          ))}
        </View>
      )}

      {/* Order-a-card nudge */}
      {!hasActiveCard && (
        <Pressable
          onPress={() => {
            onClose?.();
            router.push(path.CARD);
          }}
          className="flex-row items-center justify-between rounded-twice bg-card p-4 web:transition-colors web:hover:bg-card/70"
        >
          <View className="flex-row items-center gap-3">
            <Image
              source={getAsset('images/warning.png')}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-base font-medium text-white">
              Order your Solid card for rewards
            </Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      )}

      {/* How rewards work */}
      <Pressable
        onPress={() => setShowHow(prev => !prev)}
        className="flex-row items-center justify-between px-1 py-2"
      >
        <Text className="text-base font-medium text-white">How rewards work</Text>
        <ChevronRight
          size={18}
          color="rgba(255,255,255,0.5)"
          style={{ transform: [{ rotate: showHow ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {showHow && (
        <View className="-mt-3 gap-2 rounded-twice bg-card p-5">
          <Text className="text-sm text-white/70">
            Your friend qualifies when, within {windowDays} days of signing up, they:
          </Text>
          <Text className="text-sm text-white/70">• Order and activate a Solid card.</Text>
          <Text className="text-sm text-white/70">
            • Spend {formatUsd(spendTarget)} across {merchantTarget}+ different merchants.
          </Text>
          <Text className="text-sm text-white/70">
            You get {formatUsd(referrerUsd)} and they get {formatUsd(newUserUsd)}, credited about
            40 days after they qualify. One reward per friend, no cap.
          </Text>
        </View>
      )}

      {/* Actions */}
      <View className="gap-3">
        <Button
          onPress={handleInvite}
          className={cn('h-14 w-full rounded-2xl bg-rewards web:hover:bg-rewards/90')}
        >
          <Text className="text-base font-bold text-black">Invite Friends</Text>
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
              void navigator.clipboard?.writeText(referralLink);
            }
          }}
          className="h-14 w-full rounded-2xl border-0"
        >
          <Text className="text-base font-bold text-white">Copy Link</Text>
        </Button>
      </View>

      {/* Code + link (utility) */}
      <View className="gap-3">
        <Text className="text-sm text-white/70">Referral code</Text>
        <View className="flex-row items-center justify-between rounded-2xl bg-primary/10 p-4 ps-6">
          <Text className="text-base font-medium text-primary">{referralCode}</Text>
          <CopyToClipboard text={referralCode} />
        </View>
        <Text className="mt-2 text-sm text-white/70">Referral link</Text>
        <View className="flex-row items-center justify-between rounded-2xl bg-primary/10 p-4 ps-6">
          <Text className="flex-1 text-base font-medium text-primary" numberOfLines={1}>
            {referralLink}
          </Text>
          <CopyToClipboard text={referralLink} />
        </View>
        <Text className="mt-2 text-center text-sm text-white/70">
          Know who referred you?&nbsp;
          <Link href={path.ADD_REFERRER} onPress={() => onClose?.()} className="hover:opacity-70">
            <Text className="leading-4 text-primary web:underline">
              Add them so you both get credit
            </Text>
          </Link>
        </Text>
      </View>
    </View>
  );
}
