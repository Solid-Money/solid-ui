import { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { HandCoins } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
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

const Card = ({ children }: { children: ReactNode }) => (
  <View className="gap-3 rounded-2xl bg-card p-5">{children}</View>
);

export default function GoodDollarClaim() {
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
    refresh,
  } = useGoodDollarClaim();

  const renderAction = () => {
    if (error && !isLoading) {
      return (
        <Card>
          <Text className="text-lg font-semibold text-white">Something went wrong</Text>
          <Text className="text-sm text-muted-foreground">{error}</Text>
          <Button variant="secondary" onPress={() => void refresh()}>
            <Text>Try again</Text>
          </Button>
        </Card>
      );
    }

    if (isLoading) {
      return (
        <Card>
          <View className="items-center py-6">
            <ActivityIndicator color="#ffffff" />
          </View>
        </Card>
      );
    }

    if (!isWhitelisted) {
      return (
        <Card>
          <Text className="text-lg font-semibold text-white">Verify to start claiming</Text>
          <Text className="text-sm text-muted-foreground">
            GoodDollar requires a quick, one-time face verification (a liveness check only — no
            documents) to make sure each person claims once. It takes about a minute.
          </Text>
          <Button onPress={() => void verify()} disabled={isVerifying}>
            <Text>{isVerifying ? 'Opening verification…' : 'Verify with GoodDollar'}</Text>
          </Button>
        </Card>
      );
    }

    if (canClaim) {
      return (
        <Card>
          <Text className="text-sm text-muted-foreground">Available to claim</Text>
          <Text className="text-3xl font-semibold text-white">
            {formatGDollar(formattedEntitlement)} G$
          </Text>
          <Button onPress={() => void claim()} disabled={isClaiming}>
            {isClaiming ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text>{claimMessage ?? 'Claiming…'}</Text>
              </>
            ) : (
              <Text>Claim G$</Text>
            )}
          </Button>
        </Card>
      );
    }

    return (
      <Card>
        <Text className="text-lg font-semibold text-white">You&apos;re all caught up</Text>
        <Text className="text-sm text-muted-foreground">
          {nextClaimTime
            ? `Come back ${formatDistanceToNowStrict(nextClaimTime, {
                addSuffix: true,
              })} for your next claim.`
            : 'Your next GoodDollar UBI will be available soon.'}
        </Text>
        <Button variant="secondary" onPress={() => void refresh()}>
          <Text>Refresh</Text>
        </Button>
      </Card>
    );
  };

  return (
    <View className="mx-auto w-full max-w-[512px] gap-4 px-4 py-4">
      <View className="gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-card">
          <HandCoins size={24} color="#ffffff" strokeWidth={1.8} />
        </View>
        <Text className="text-2xl font-semibold text-white">GoodDollar UBI</Text>
        <Text className="text-base text-muted-foreground">
          Claim your daily GoodDollar (G$) basic income on Fuse.
        </Text>
      </View>

      <View className="gap-3 rounded-2xl bg-card p-5">
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Your G$ balance</Text>
          <Text className="text-3xl font-semibold text-white">
            {formatGDollar(formattedBalance)} G$
          </Text>
          <Text className="text-xs text-muted-foreground">
            Claimed G$ is sent to your signer wallet on Fuse. Move it to your Solid wallet to use it
            for swaps and sends.
          </Text>
        </View>
        {canSweep && (
          <Button variant="secondary" onPress={() => void sweep()} disabled={isSweeping}>
            {isSweeping ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text>Moving to your wallet…</Text>
              </>
            ) : (
              <Text>Move to Solid wallet</Text>
            )}
          </Button>
        )}
      </View>

      {renderAction()}
    </View>
  );
}
