import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, X } from 'lucide-react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';
import { useReferralSummary } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ReferralFriendStage } from '@/lib/types';

import ReferralFriendRow, { formatUsdWhole, REFERRAL_SUCCESS_COLOR } from './ReferralFriendRow';
import ReferralHeroAnimation from './ReferralHeroAnimation';

const REFERRAL_BASE_URL = 'https://www.solid.xyz/refer?ref=';

// Matches the app's `--background` token (see global.css) — used for the top/bottom
// scroll fades so they blend seamlessly into the modal's background.
const MODAL_BACKGROUND = 'hsl(240, 3.23%, 6.08%)';
const MODAL_BACKGROUND_TRANSPARENT = 'hsla(240, 3.23%, 6.08%, 0)';
const TOP_FADE_HEIGHT = 96;
const BOTTOM_FADE_HEIGHT = 64;

/** Poll cadence while a reward is past its ETA but not yet reported paid. */
const SETTLING_POLL_MS = 60_000;

function ChecklistRow({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Image
        source={getAsset(icon as any)}
        style={{ width: 33, height: 33 }}
        contentFit="contain"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-white">{title}</Text>
        <Text className="text-sm leading-[1.1] text-white/70">{children}</Text>
      </View>
    </View>
  );
}

function ShareAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center gap-2 web:transition-opacity web:hover:opacity-80"
    >
      <Image
        source={getAsset(icon as any)}
        style={{ width: 45, height: 45 }}
        contentFit="contain"
      />
      <Text className="text-sm text-white/70">{label}</Text>
    </Pressable>
  );
}

interface ReferralProgramContentNewProps {
  isActive: boolean;
  onClose: () => void;
}

export default function ReferralProgramContentNew({
  isActive,
  onClose,
}: ReferralProgramContentNewProps) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [isSettling, setIsSettling] = useState(false);
  const { data: summary, refetch } = useReferralSummary({
    refetchInterval: isSettling ? SETTLING_POLL_MS : false,
  });
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const referralCode = user?.referralCode ?? '';
  const referralLink = `${REFERRAL_BASE_URL}${referralCode}`;
  const message = `Join me on Solid — order a card, spend, and we both earn. Use my link: ${referralLink}`;

  const referrerUsd = summary?.rewards.referrerUsd ?? 15;
  const newUserUsd = summary?.rewards.newUserUsd ?? 10;
  const spendTarget = summary?.qualification.spendTargetUsd ?? 75;
  const merchantTarget = summary?.qualification.merchantTarget ?? 3;
  const windowDays = summary?.qualification.windowDays ?? 30;
  const payoutDelayDays = summary?.qualification.payoutDelayDays ?? 30;
  const referrals = summary?.referrals ?? [];
  const totalRewardedUsd = summary?.totalRewardedUsd ?? 0;

  const handleWhatsApp = useCallback(async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      if (Platform.OS === 'web') {
        window.open(webUrl, '_blank');
        return;
      }
      const supported = await Linking.canOpenURL(url);
      await Linking.openURL(supported ? url : webUrl);
    } catch (error) {
      console.error('Failed to open WhatsApp:', error);
    }
  }, [message]);

  const handleTelegram = useCallback(async () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
      message,
    )}`;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open Telegram:', error);
    }
  }, [message, referralLink]);

  const handleCopyLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(referralLink);
      setLinkCopied(true);
    } catch (error) {
      console.error('Failed to copy referral link:', error);
    }
  }, [referralLink]);

  const handleMore = useCallback(async () => {
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
  }, [message, referralLink]);

  useEffect(() => {
    if (!linkCopied) return;
    const timeout = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [linkCopied]);

  // A friend whose payout ETA has passed but who the API still reports as
  // unlocking is "settling": the sweep is due but hasn't confirmed. Poll until
  // it does, then stop — this is what keeps the row flipping to Completed on
  // its own rather than stranding the user on a finished countdown.
  const hasSettlingReward = referrals.some(
    item =>
      item.stage === ReferralFriendStage.REWARD_UNLOCKING &&
      !!item.payoutEtaAt &&
      Date.parse(item.payoutEtaAt) <= Date.now(),
  );
  useEffect(() => {
    setIsSettling(hasSettlingReward);
  }, [hasSettlingReward]);

  const handlePayoutDue = useCallback(() => {
    setIsSettling(true);
    void refetch();
  }, [refetch]);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 72,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 16,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center">
          <ReferralHeroAnimation isActive={isActive} />
          <Text className="mt-3 text-center text-3xl font-semibold leading-9 text-white">
            Invite friends &{'\n'}Earn together
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row overflow-hidden rounded-twice bg-card">
          <View className="flex-1 items-center gap-3 py-[22px]">
            <Text className="text-base text-white/70">You get</Text>
            <Text className="text-[26px] font-semibold leading-[32px] text-white">
              {formatUsdWhole(referrerUsd)}
            </Text>
          </View>
          <View className="w-px bg-white/10" />
          <View className="flex-1 items-center gap-3 py-[22px]">
            <Text className="text-base text-white/70">Your friend get</Text>
            <Text className="text-[26px] font-semibold leading-[32px] text-white">
              {formatUsdWhole(newUserUsd)}
            </Text>
          </View>
        </View>

        {/* Earned so far — only once there is something to celebrate. */}
        {totalRewardedUsd > 0 ? (
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="-mt-3 flex-row items-center justify-center gap-2 rounded-twice bg-referral-success/[0.12] px-5 py-3"
          >
            <Text className="text-sm text-referral-success">Earned from referrals</Text>
            <CountUp
              count={totalRewardedUsd}
              decimalPlaces={0}
              prefix="$"
              styles={{
                wholeText: {
                  color: REFERRAL_SUCCESS_COLOR,
                  fontSize: 18,
                  fontWeight: '600',
                },
              }}
            />
          </Animated.View>
        ) : null}

        {/* Checklist */}
        <View className="gap-2">
          <Text className="px-1 text-base text-white/50">Your friend have to</Text>
          <View className="gap-5 rounded-twice bg-card p-5">
            <ChecklistRow
              icon="images/referral-new-icon-account.png"
              title="Create a Solid account"
            >
              And get verified
            </ChecklistRow>
            <ChecklistRow
              icon="images/referral-new-icon-deposit.png"
              title="Deposit to their account"
            >
              Via bank deposit or crypto
            </ChecklistRow>
            <ChecklistRow icon="images/referral-new-icon-wallet.png" title="Make 3+ purchases">
              spend {formatUsdWhole(spendTarget)} across {merchantTarget}+ payments at different
              merchants within {windowDays} days.
            </ChecklistRow>
          </View>
        </View>

        {/* Share the link */}
        <View className="gap-2">
          <Text className="px-1 text-base text-white/50">Share the link</Text>
          <View className="flex-row items-start justify-between rounded-twice bg-card px-[25px] py-5">
            <ShareAction
              icon="images/referral-new-whatsapp.png"
              label="WhatsApp"
              onPress={handleWhatsApp}
            />
            <ShareAction
              icon="images/referral-new-telegram.png"
              label="Telegram"
              onPress={handleTelegram}
            />
            <ShareAction
              icon="images/referral-new-copy-link.png"
              label={linkCopied ? 'Copied!' : 'Copy link'}
              onPress={handleCopyLink}
            />
            <ShareAction icon="images/referral-new-more.png" label="More" onPress={handleMore} />
          </View>
        </View>

        {/* Invited friends */}
        <View className="gap-2">
          <Text className="px-1 text-base text-white/50">Invited friends ({referrals.length})</Text>
          {referrals.length > 0 ? (
            // No padding here: each row carries the design's 16px sides so the
            // dividers run the full width of the card. `overflow-hidden` keeps
            // them inside the rounded corners.
            <View className="overflow-hidden rounded-twice bg-card">
              {referrals.map((item, index) => (
                <ReferralFriendRow
                  key={item.referredUserId || `${item.signupAt}-${index}`}
                  item={item}
                  index={index}
                  spendTargetUsd={spendTarget}
                  merchantTarget={merchantTarget}
                  onPayoutDue={handlePayoutDue}
                />
              ))}
            </View>
          ) : (
            <View className="items-center justify-center rounded-twice bg-card px-5 py-9">
              <Text className="text-base text-white/50">Your invited friends will appear here</Text>
            </View>
          )}
        </View>

        {/* Learn more */}
        <Pressable
          onPress={() => setShowLearnMore(prev => !prev)}
          className="flex-row items-center justify-between px-1 py-2"
        >
          <Text className="flex-1 pr-2 text-base font-medium text-white/70">
            Learn more about the referral program
          </Text>
          <ChevronRight
            size={20}
            color="rgba(255,255,255,0.7)"
            style={{ transform: [{ rotate: showLearnMore ? '90deg' : '0deg' }], flexShrink: 0 }}
          />
        </Pressable>
        {showLearnMore && (
          <View className="-mt-3 gap-2 rounded-twice bg-card p-5">
            <Text className="text-sm text-white/70">
              Your friend qualifies when, within {windowDays} days of signing up, they:
            </Text>
            <Text className="text-sm text-white/70">
              • Create a Solid account and get verified.
            </Text>
            <Text className="text-sm text-white/70">
              • Deposit to their account via bank deposit or crypto.
            </Text>
            <Text className="text-sm text-white/70">
              • Spend {formatUsdWhole(spendTarget)} across {merchantTarget}+ different merchants.
            </Text>
            <Text className="text-sm text-white/70">
              You get {formatUsdWhole(referrerUsd)} and they get {formatUsdWhole(newUserUsd)},
              credited {payoutDelayDays} days after they qualify — that window covers refunds and
              disputes. You&apos;ll see the exact unlock date on each friend above. One reward per
              friend, no cap.
            </Text>
          </View>
        )}
      </ScrollView>

      <LinearGradient
        colors={[MODAL_BACKGROUND, MODAL_BACKGROUND_TRANSPARENT]}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: TOP_FADE_HEIGHT,
        }}
      >
        <Pressable
          onPress={onClose}
          className="absolute right-4 h-[50px] w-[50px] items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted"
          style={{ top: 12 }}
        >
          <X size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </LinearGradient>

      <LinearGradient
        colors={[MODAL_BACKGROUND_TRANSPARENT, MODAL_BACKGROUND]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + BOTTOM_FADE_HEIGHT,
        }}
      />
    </View>
  );
}
