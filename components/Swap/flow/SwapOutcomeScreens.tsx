import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import { ArrowUpRight, Check } from 'lucide-react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { BRAND, DetailCard, StepTracker, TrackerStep } from '@/components/Send/CrossChain/shared';
import { openSendWithReceived } from '@/components/Swap/flow/sendReceived';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { fetchCrossChainSend } from '@/lib/api/cross-chain-send';
import { withRefreshToken } from '@/lib/utils';
import { formatSwapAmount, formatSwapUsd } from '@/lib/utils/swap/format';
import { getChain } from '@/lib/wagmi';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { SwapReceipt, useSwapState } from '@/store/swapStore';

/** How long the swap modal takes to leave before Send's opens: two sheets at once is what this avoids. */
const SHEET_HANDOFF_MS = 200;

const timeOf = (at: number) => format(at, 'HH:mm');
const whenOf = (at: number) => `${isToday(at) ? 'Today' : format(at, 'd MMM')}, ${timeOf(at)}`;

const useCloseSwap = () => {
  const { setModal, resetForm, setReceipt } = useSwapState(
    useShallow(state => ({
      setModal: state.actions.setModal,
      resetForm: state.actions.resetForm,
      setReceipt: state.actions.setReceipt,
    })),
  );
  return useCallback(() => {
    resetForm();
    setModal(SWAP_MODAL.CLOSE);
    setReceipt(undefined);
  }, [resetForm, setModal, setReceipt]);
};

const OutcomeIcon = ({ kind }: { kind: 'done' | 'moving' }) => (
  <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-[rgba(148,242,127,0.16)]">
    <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-[rgba(148,242,127,0.24)]">
      {kind === 'done' ? (
        <Check size={28} color={BRAND} strokeWidth={3} />
      ) : (
        <ArrowUpRight size={28} color={BRAND} strokeWidth={2.5} />
      )}
    </View>
  </View>
);

/** Screen 5 of the swap: it's done, the coin is in the wallet, and it can go straight on to Send. */
export const SwapSwappedScreen: React.FC = () => {
  const router = useRouter();
  const receipt = useSwapState(state => state.receipt);
  const close = useCloseSwap();

  const handleActivity = useCallback(() => {
    close();
    router.push(path.ACTIVITY);
  }, [close, router]);

  const handleSend = useCallback(() => {
    if (!receipt) return;
    close();
    setTimeout(() => openSendWithReceived(receipt), SHEET_HANDOFF_MS);
  }, [close, receipt]);

  if (!receipt) return null;

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-8">
        <View className="items-center gap-3">
          <OutcomeIcon kind="done" />
          <Text className="text-center text-2xl font-semibold text-white">Swapped</Text>
          <Text className="text-center text-base text-white/70">
            {formatSwapAmount(receipt.toAmount)} {receipt.toName} is in your wallet
          </Text>
        </View>
        <DetailCard
          rows={[
            {
              key: 'paid',
              label: 'You paid',
              value: `${formatSwapAmount(receipt.fromAmount)} ${receipt.fromName}`,
            },
            {
              key: 'got',
              label: 'You got',
              value: `${formatSwapAmount(receipt.toAmount)} ${receipt.toName}`,
            },
            {
              key: 'fee',
              label: 'Fee',
              value:
                receipt.feeUsd === undefined
                  ? '—'
                  : receipt.feeUsd === 0
                    ? 'Free'
                    : formatSwapUsd(receipt.feeUsd),
            },
            { key: 'time', label: 'Time', value: whenOf(receipt.completedAt) },
          ]}
        />
      </View>

      <View className="gap-3">
        <Pressable onPress={handleActivity} className="items-center py-2">
          <Text className="text-base font-medium text-brand">View in Activity</Text>
        </Pressable>
        <Button variant="brand" className="h-12 rounded-full" size="lg" onPress={handleSend}>
          <Text className="text-base font-bold">Send it</Text>
        </Button>
        <Button variant="secondary" className="h-12 rounded-full" size="lg" onPress={close}>
          <Text className="text-base font-bold text-white">Done</Text>
        </Button>
      </View>
    </View>
  );
};

/**
 * Screen 6 of the swap: sent from one network, landing on another. The same
 * tracker as a cross-network send. Closing it is fine; the backend keeps
 * tracking and the activity row follows.
 */
export const SwapOnItsWayScreen: React.FC = () => {
  const receipt = useSwapState(state => state.receipt);
  if (receipt?.bridge) return <BridgeOnItsWay receipt={receipt} bridge={receipt.bridge} />;
  return <LifiOnItsWay />;
};

/** A LI.FI swap across networks, fed by the LI.FI status watcher. */
const LifiOnItsWay: React.FC = () => {
  const receipt = useSwapState(state => state.receipt);
  const tracked = useLifiSwapStore(state =>
    receipt?.clientTxId ? state.swaps[receipt.clientTxId] : undefined,
  );
  const close = useCloseSwap();

  const steps = useMemo((): TrackerStep[] => {
    if (!receipt) return [];
    const fromChain = CHAIN_NAMES[receipt.fromChainId] ?? 'the first network';
    const toChain = CHAIN_NAMES[receipt.toChainId] ?? 'the other network';
    const status = tracked?.status;
    const done = status === 'DONE';
    const failed = status === 'FAILED' || status === 'INVALID';
    const sentLink = tracked?.explorerLink ?? `https://scan.li.fi/tx/${receipt.transactionHash}`;
    const minutes = Math.max(1, Math.round((tracked?.etaSeconds ?? 120) / 60));

    const converting: TrackerStep = done
      ? {
          key: 'converting',
          tone: 'done',
          title:
            tracked?.substatus === 'PARTIAL'
              ? `Delivered as ${tracked.toSymbol}`
              : `Converting to ${receipt.toName}`,
          subtitle: tracked?.substatus === 'REFUNDED' ? 'Refunded' : 'Done',
          subtitleTone: 'muted',
        }
      : failed
        ? {
            key: 'converting',
            tone: 'failed',
            title: `Converting to ${receipt.toName}`,
            subtitle:
              tracked?.substatusMessage || 'This didn’t go through. Your coins are being returned.',
            subtitleTone: 'danger',
          }
        : {
            key: 'converting',
            tone: 'active',
            title: `Converting to ${receipt.toName}`,
            subtitle: `About ${minutes} min`,
            subtitleTone: 'muted',
          };

    return [
      {
        key: 'sent',
        tone: 'done',
        title: `Sent from ${fromChain}`,
        subtitle: `${timeOf(receipt.completedAt)} · View transaction`,
        subtitleTone: 'brand',
        onSubtitlePress: () => void Linking.openURL(sentLink),
      },
      converting,
      done && tracked?.receivingTxLink
        ? {
            key: 'arrived',
            tone: 'done',
            title: `Arrived on ${toChain}`,
            subtitle: 'View transaction',
            subtitleTone: 'brand',
            onSubtitlePress: () => void Linking.openURL(tracked.receivingTxLink!),
          }
        : {
            key: 'arrived',
            tone: done ? 'done' : 'pending',
            title: `Arrived on ${toChain}`,
            subtitle: done ? 'Done' : 'View transaction once it lands',
            subtitleTone: 'muted',
          },
    ];
  }, [receipt, tracked]);

  if (!receipt) return null;
  const toChain = CHAIN_NAMES[receipt.toChainId] ?? '';

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-6">
        <View className="items-center gap-3">
          <OutcomeIcon kind="moving" />
          <Text className="text-center text-2xl font-semibold text-white">
            {tracked?.status === 'DONE' ? 'Swap arrived' : 'Swap on its way'}
          </Text>
          <Text className="text-center text-base text-white/70">
            {formatSwapAmount(receipt.fromAmount)} {receipt.fromName} →{' '}
            {formatSwapAmount(receipt.toAmount)} {receipt.toName} on {toChain}
          </Text>
        </View>
        <StepTracker steps={steps} />
        <Text className="text-center text-sm text-white/60">
          You can close this screen. We’ll let you know when it arrives.
        </Text>
      </View>

      <Button variant="secondary" className="h-12 rounded-full" size="lg" onPress={close}>
        <Text className="text-base font-bold text-white">Done</Text>
      </Button>
    </View>
  );
};

/** Send statuses after which nothing more happens. */
const BRIDGE_SETTLED: ReadonlySet<string> = new Set(['delivered', 'failed', 'expired']);
const BRIDGE_POLL_MS = 5_000;

const explorerTx = (chainId: number, hash: string) => {
  const explorer = getChain(chainId)?.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${hash}` : undefined;
};

/**
 * A move over Solid's bridge, followed through the backend's send tracker.
 * When "You get" was another Fuse coin, the bridge lands USDC or USDT and,
 * once it's there, this offers the swap that finishes the job, at the price
 * then. Leaving first is fine: the coin waits on Fuse, ready to swap.
 */
const BridgeOnItsWay = ({
  receipt,
  bridge,
}: {
  receipt: SwapReceipt;
  bridge: NonNullable<SwapReceipt['bridge']>;
}) => {
  const close = useCloseSwap();
  const openSwap = useSwapState(state => state.actions.openSwap);
  const { sendId, sentDecimals, thenSwap } = bridge;

  const { data: send } = useQuery({
    queryKey: ['cross-chain-send', sendId],
    queryFn: () => withRefreshToken(() => fetchCrossChainSend(sendId)),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status && BRIDGE_SETTLED.has(status) ? false : BRIDGE_POLL_MS;
    },
  });

  const status = send?.status;
  const delivered = status === 'delivered';
  const failed = status === 'failed' || status === 'expired';
  const fromChain = CHAIN_NAMES[receipt.fromChainId] ?? 'the first network';
  const toChain = CHAIN_NAMES[receipt.toChainId] ?? 'the other network';
  const moving = thenSwap?.landsAsName ?? receipt.toName;
  // What landed, exactly, for the swap that follows.
  const landed =
    delivered && send ? formatUnits(BigInt(send.amountReceivedLD), sentDecimals) : undefined;

  const steps = useMemo((): TrackerStep[] => {
    const sentLink =
      send?.srcExplorerUrl ?? explorerTx(receipt.fromChainId, receipt.transactionHash);
    const minutes = Math.max(1, send?.etaMinutes ?? 2);
    const list: TrackerStep[] = [
      {
        key: 'sent',
        tone: 'done',
        title: `Sent from ${fromChain}`,
        subtitle: sentLink
          ? `${timeOf(receipt.completedAt)} · View transaction`
          : timeOf(receipt.completedAt),
        subtitleTone: sentLink ? 'brand' : 'muted',
        onSubtitlePress: sentLink ? () => void Linking.openURL(sentLink) : undefined,
      },
      delivered
        ? {
            key: 'moving',
            tone: 'done',
            title: `Moving ${moving} to ${toChain}`,
            subtitle: 'Done',
            subtitleTone: 'muted',
          }
        : failed
          ? {
              key: 'moving',
              tone: 'failed',
              title: `Moving ${moving} to ${toChain}`,
              subtitle: send?.failureReason || 'This didn’t go through. We’re looking into it.',
              subtitleTone: 'danger',
            }
          : {
              key: 'moving',
              tone: 'active',
              title: `Moving ${moving} to ${toChain}`,
              subtitle: status === 'stuck' ? 'Taking longer than usual' : `About ${minutes} min`,
              subtitleTone: 'muted',
            },
      delivered && send?.dstExplorerUrl
        ? {
            key: 'arrived',
            tone: 'done',
            title: `Arrived on ${toChain}`,
            subtitle: 'View transaction',
            subtitleTone: 'brand',
            onSubtitlePress: () => void Linking.openURL(send.dstExplorerUrl!),
          }
        : {
            key: 'arrived',
            tone: delivered ? 'done' : 'pending',
            title: `Arrived on ${toChain}`,
            subtitle: delivered ? 'Done' : 'View transaction once it lands',
            subtitleTone: 'muted',
          },
    ];
    if (thenSwap) {
      list.push({
        key: 'swap',
        tone: delivered ? 'active' : 'pending',
        title: `Swap to ${receipt.toName}`,
        subtitle: delivered ? 'Ready when you are' : 'Once it arrives',
        subtitleTone: 'muted',
      });
    }
    return list;
  }, [send, receipt, delivered, failed, status, fromChain, toChain, moving, thenSwap]);

  const handleSwapNow = useCallback(() => {
    if (!thenSwap || !landed) return;
    openSwap({
      entryPoint: 'swap_arrival',
      input: thenSwap.landsAs,
      output: thenSwap.to,
      amount: landed,
    });
  }, [openSwap, thenSwap, landed]);

  const title = delivered
    ? thenSwap
      ? `${moving} is on ${toChain}`
      : 'Swap arrived'
    : thenSwap
      ? `Moving ${moving} to ${toChain}`
      : 'Swap on its way';
  const summary = thenSwap
    ? `${formatSwapAmount(receipt.fromAmount)} ${receipt.fromName} → ${moving} on ${toChain}, then ${receipt.toName}`
    : `${formatSwapAmount(receipt.fromAmount)} ${receipt.fromName} → ${formatSwapAmount(receipt.toAmount)} ${receipt.toName} on ${toChain}`;

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-6">
        <View className="items-center gap-3">
          <OutcomeIcon kind={delivered && !thenSwap ? 'done' : 'moving'} />
          <Text className="text-center text-2xl font-semibold text-white">{title}</Text>
          <Text className="text-center text-base text-white/70">{summary}</Text>
        </View>
        <StepTracker steps={steps} />
        <Text className="text-center text-sm text-white/60">
          {thenSwap
            ? delivered
              ? `Swap your ${formatSwapAmount(Number(landed))} ${moving} to ${receipt.toName} now, or any time from Swap.`
              : `You can close this screen. Your ${moving} waits on ${toChain}, ready to swap to ${receipt.toName}.`
            : 'You can close this screen. We’ll let you know when it arrives.'}
        </Text>
      </View>

      <View className="gap-3">
        {thenSwap && delivered ? (
          <Button variant="brand" className="h-12 rounded-full" size="lg" onPress={handleSwapNow}>
            <Text className="text-base font-bold">Swap to {receipt.toName}</Text>
          </Button>
        ) : null}
        <Button variant="secondary" className="h-12 rounded-full" size="lg" onPress={close}>
          <Text className="text-base font-bold text-white">Done</Text>
        </Button>
      </View>
    </View>
  );
};
