import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowRightLeft, HandCoins, ScanFace } from 'lucide-react-native';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useGoodDollarClaim from '@/hooks/useGoodDollarClaim';

const formatGDollar = (value: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  try {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } catch {
    return value;
  }
};

export default function GoodDollarClaim() {
  const { isScreenMedium } = useDimension();
  const {
    isLoading,
    isWhitelisted,
    canClaim,
    canSweep,
    isVerifying,
    isClaiming,
    isSweeping,
    claimMessage,
    nextClaimTime,
    error,
    formattedBalance,
    formattedEntitlement,
    verify,
    claim,
    sweep,
  } = useGoodDollarClaim();

  // Keep the layout visible during subsequent refreshes; only show the
  // full-screen spinner on the very first load.
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => {
    if (!isLoading) setEverLoaded(true);
  }, [isLoading]);

  if (isLoading && !everLoaded) {
    return (
      <View className="mx-auto w-full max-w-7xl px-4 py-6 md:py-12">
        <View className="items-center py-12">
          <ActivityIndicator color="white" />
        </View>
      </View>
    );
  }

  return (
    <View className="mx-auto w-full max-w-7xl gap-10 px-4 py-6 md:gap-12 md:py-12">
      <Header
        isScreenMedium={isScreenMedium}
        isWhitelisted={isWhitelisted}
        canClaim={canClaim}
        canSweep={canSweep}
        isVerifying={isVerifying}
        isClaiming={isClaiming}
        isSweeping={isSweeping}
        claimMessage={claimMessage}
        onVerify={verify}
        onClaim={claim}
        onSweep={sweep}
      />

      <View className="flex-col gap-6 md:flex-row">
        <View className="flex-1">
          <BalanceCard
            balanceLoading={isLoading}
            formattedBalance={formattedBalance}
            formattedEntitlement={formattedEntitlement}
          />
        </View>
        <View className="flex-1">
          <ExplanationCard
            isWhitelisted={isWhitelisted}
            canClaim={canClaim}
            nextClaimTime={nextClaimTime}
            error={error}
            formattedEntitlement={formattedEntitlement}
          />
        </View>
      </View>
    </View>
  );
}

interface HeaderProps {
  isScreenMedium: boolean;
  isWhitelisted: boolean;
  canClaim: boolean;
  canSweep: boolean;
  isVerifying: boolean;
  isClaiming: boolean;
  isSweeping: boolean;
  claimMessage: string | null;
  onVerify: () => void;
  onClaim: () => void;
  onSweep: () => void;
}

function Header({
  isScreenMedium,
  isWhitelisted,
  canClaim,
  canSweep,
  isVerifying,
  isClaiming,
  isSweeping,
  claimMessage,
  onVerify,
  onClaim,
  onSweep,
}: HeaderProps) {
  const hasActions = !isWhitelisted || canClaim || canSweep;

  const titleBlock = (
    <View className="flex-row items-center gap-3">
      <BackButton />
      <View className="gap-1">
        <Text className={isScreenMedium ? 'text-5xl font-semibold' : 'text-3xl font-semibold'}>
          GoodDollar
        </Text>
        <Text className="text-base text-muted-foreground">Claim your daily UBI on Fuse</Text>
      </View>
    </View>
  );

  if (isScreenMedium) {
    return (
      <View className="flex-row items-center justify-between">
        {titleBlock}
        <View className="flex-row items-center gap-2">
          {canSweep && (
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 bg-[#303030] px-6"
              onPress={() => void onSweep()}
              disabled={isSweeping}
            >
              <View className="flex-row items-center gap-2">
                {isSweeping ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <ArrowRightLeft size={18} color="white" />
                )}
                <Text className="text-base font-bold text-white">
                  {isSweeping ? 'Moving…' : 'Move to wallet'}
                </Text>
              </View>
            </Button>
          )}
          {!isWhitelisted ? (
            <Button
              className="h-12 rounded-xl border-0 bg-[#94F27F] px-6"
              onPress={() => void onVerify()}
              disabled={isVerifying}
            >
              <View className="flex-row items-center gap-2">
                {isVerifying ? (
                  <ActivityIndicator size="small" color="black" />
                ) : (
                  <ScanFace size={18} color="black" />
                )}
                <Text className="text-base font-bold text-black">
                  {isVerifying ? 'Opening…' : 'Verify'}
                </Text>
              </View>
            </Button>
          ) : canClaim ? (
            <Button
              className="h-12 rounded-xl border-0 bg-[#94F27F] px-6"
              onPress={() => void onClaim()}
              disabled={isClaiming}
            >
              <View className="flex-row items-center gap-2">
                {isClaiming ? (
                  <ActivityIndicator size="small" color="black" />
                ) : (
                  <HandCoins size={18} color="black" />
                )}
                <Text className="text-base font-bold text-black">
                  {isClaiming ? (claimMessage ?? 'Claiming…') : 'Claim G$'}
                </Text>
              </View>
            </Button>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="gap-6">
      {titleBlock}
      {hasActions && (
        <View className="flex-row items-center justify-around">
          {!isWhitelisted ? (
            <CircleAction
              icon={
                isVerifying ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <ScanFace size={22} color="black" />
                )
              }
              label={isVerifying ? 'Opening…' : 'Verify'}
              onPress={onVerify}
              disabled={isVerifying}
            />
          ) : canClaim ? (
            <CircleAction
              icon={
                isClaiming ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <HandCoins size={22} color="black" />
                )
              }
              label="Claim"
              onPress={onClaim}
              disabled={isClaiming}
            />
          ) : null}
          {canSweep && (
            <CircleAction
              icon={
                isSweeping ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ArrowRightLeft size={22} color="white" />
                )
              }
              label="Move"
              onPress={onSweep}
              variant="dark"
              disabled={isSweeping}
            />
          )}
        </View>
      )}
    </View>
  );
}

interface CircleActionProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'brand' | 'dark';
  disabled?: boolean;
}

function CircleAction({ icon, label, onPress, variant = 'brand', disabled }: CircleActionProps) {
  return (
    <View className="flex-1 items-center">
      <Pressable
        onPress={disabled ? undefined : onPress}
        className={`h-14 w-14 items-center justify-center rounded-full web:hover:opacity-80 ${
          variant === 'brand' ? 'bg-[#94F27F]' : 'bg-[#303030]'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {icon}
      </Pressable>
      <Text className="mt-2 text-sm text-[#BFBFBF]">{label}</Text>
    </View>
  );
}

interface BalanceCardProps {
  balanceLoading: boolean;
  formattedBalance: string;
  formattedEntitlement: string;
}

function BalanceCard({ balanceLoading, formattedBalance, formattedEntitlement }: BalanceCardProps) {
  return (
    <View className="relative h-full min-h-[260px] overflow-hidden rounded-[20px] px-[36px] py-[30px]">
      <LinearGradient
        colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          opacity: 0.3,
        }}
      />
      <View className="flex-1 justify-between gap-12">
        <View>
          <Text className="mb-2 text-base text-white/70">Your G$ balance</Text>
          {balanceLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-[50px] font-semibold leading-tight text-white">
              {formatGDollar(formattedBalance)} G$
            </Text>
          )}
        </View>
        <View>
          <Text className="mb-1 text-lg font-medium text-white/60">Claimable now</Text>
          <Text className="text-2xl font-semibold text-white">
            {formatGDollar(formattedEntitlement)} G$
          </Text>
        </View>
      </View>
    </View>
  );
}

interface ExplanationCardProps {
  isWhitelisted: boolean;
  canClaim: boolean;
  nextClaimTime: Date | null;
  error: string | null;
  formattedEntitlement: string;
}

function ExplanationCard({
  isWhitelisted,
  canClaim,
  nextClaimTime,
  error,
  formattedEntitlement,
}: ExplanationCardProps) {
  let heading: string;
  let body: string;

  if (error) {
    heading = 'Something went wrong';
    body = error;
  } else if (!isWhitelisted) {
    heading = 'Verify to start claiming';
    body =
      'GoodDollar requires a quick, one-time face verification — a liveness check only, no documents — to make sure each person claims once. Tap Verify to begin; it takes about a minute.';
  } else if (canClaim) {
    heading = 'Your UBI is ready';
    body = `You have ${formatGDollar(formattedEntitlement)} G$ available. Tap Claim to receive it in your wallet on Fuse.`;
  } else {
    heading = 'You’re all caught up';
    body = nextClaimTime
      ? `Come back ${formatDistanceToNowStrict(nextClaimTime, { addSuffix: true })} for your next claim.`
      : 'Your next GoodDollar UBI will be available soon.';
  }

  return (
    <View className="h-full gap-3 rounded-2xl bg-[#1C1C1C] p-6">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#262626]">
          <HandCoins size={20} color="#ffffff" />
        </View>
        <Text className="text-lg font-semibold text-white">GoodDollar UBI</Text>
      </View>
      <Text className="text-lg font-semibold text-white">{heading}</Text>
      <Text className="text-sm leading-relaxed text-white/60">{body}</Text>
    </View>
  );
}
