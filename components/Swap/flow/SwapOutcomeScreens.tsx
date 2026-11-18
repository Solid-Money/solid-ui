import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import { ArrowUpRight, Check, X } from 'lucide-react-native';
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

const OutcomeIcon = ({ kind }: { kind: 'done' | 'moving' | 'failed' }) =>
  kind === 'failed' ? (
    <View className="h-[120px] w-[120px] items-center justify-center rounded-full border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.08)]">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(248,113,113,0.27)]">
        <X size={30} color="#f87171" strokeWidth={3} />
      </View>
    </View>
  ) : (
    <View className="h-[120px] w-[120px] items-center justify-center rounded-full border border-[rgba(148,242,127,0.2)] bg-[rgba(148,242,127,0.08)]">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(148,242,127,0.27)]">
        {kind === 'done' ? (
          <Check size={30} color={BRAND} strokeWidth={3} />
        ) : (
          <ArrowUpRight size={30} color={BRAND} strokeWidth={2.5} />
        )}
      </View>
    </View>
  );

/** The line under a tracker: a failed swap promises no arrival. */
const trackerFootnote = (failed: boolean) =>
  failed
    ? 'You can close this screen. If your coins aren’t back in your wallet soon, contact support.'
    : 'You can close this screen. We’ll let you know when it arrives.';

/** Screen 5 of the swap: it's done, the coin is in the wallet, and it can go straight on to Send. */
export const SwapSwappedScreen: React.FC = () => {
  const receipt = useSwapState(state => state.receipt);
  if (!receipt) return null;
  return <SwappedView receipt={receipt} />;
};

/**
 * "Swapped": straight after a swap on one network, and when a swap across
 * networks lands, with what arrived (`receipt.toAmount`).
 */
const SwappedView = ({ receipt }: { receipt: SwapReceipt }) => {
  const router = useRouter();
  const close = useCloseSwap();

  const handleActivity = useCallback(() => {
    close();
    router.push(path.ACTIVITY);
  }, [close, router]);

  const handleSend = useCallback(() => {
    close();
    setTimeout(() => openSendWithReceived(receipt), SHEET_HANDOFF_MS);
  }, [close, receipt]);

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-8">
        <View className="items-center gap-3">
          <OutcomeIcon kind="done" />
          <Text className="mt-3 text-center text-[26px] font-semibold leading-8 text-white">
            Swapped
          </Text>
          <Text className="text-center text-base text-white/60">
            {formatSwapAmount(receipt.toAmount)} {receipt.toName} is in your wallet
          </Text>
        </View>
        <DetailCard
          dense
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
 * tracker as a cross-network send. Closing it is fine; the tracking carries on
 * and the activity row follows.
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
  const failed = tracked?.status === 'FAILED' || tracked?.status === 'INVALID';

  const steps = useMemo((): TrackerStep[] => {
    if (!receipt) return [];
    const fromChain = CHAIN_NAMES[receipt.fromChainId] ?? 'the first network';
    const toChain = CHAIN_NAMES[receipt.toChainId] ?? 'the other network';
    const status = tracked?.status;
    const done = status === 'DONE';
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
  }, [receipt, tracked, failed]);

  if (!receipt) return null;
  // Landed whole: the same "Swapped" as a swap on one network, with what arrived.
  if (tracked?.status === 'DONE' && !tracked.substatus?.match(/PARTIAL|REFUNDED/)) {
    const arrived = Number(tracked.toAmount);
    return <SwappedView receipt={arrived > 0 ? { ...receipt, toAmount: arrived } : receipt} />;
  }
  const toChain = CHAIN_NAMES[receipt.toChainId] ?? '';

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-6">
        <View className="items-center gap-3">
          <OutcomeIcon kind={failed ? 'failed' : 'moving'} />
          <Text className="text-center text-2xl font-semibold text-white">
            {failed
              ? 'Swap didn’t go through'
              : tracked?.status === 'DONE'
                ? 'Swap arrived'
                : 'Swap on its way'}
          </Text>
          <Text className="text-center text-base text-white/70">
            {formatSwapAmount(receipt.fromAmount)} {receipt.fromName} →{' '}
            {formatSwapAmount(receipt.toAmount)} {receipt.toName} on {toChain}
          </Text>
        </View>
        <StepTracker steps={steps} />
        <Text className="text-center text-sm text-white/60">{trackerFootnote(failed)}</Text>
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
 * USDC or USDT moving over Solid's bridge, followed through the backend's send
 * tracker; "Swapped" once it lands.
 */
const BridgeOnItsWay = ({
  receipt,
  bridge,
}: {
  receipt: SwapReceipt;
  bridge: NonNullable<SwapReceipt['bridge']>;
}) => {
  const { sendId } = bridge;
  const close = useCloseSwap();

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

  const steps = useMemo((): TrackerStep[] => {
    const sentLink =
      send?.srcExplorerUrl ?? explorerTx(receipt.fromChainId, receipt.transactionHash);
    const minutes = Math.max(1, send?.etaMinutes ?? 2);
    const moving = `Moving ${receipt.toName} to ${toChain}`;
    return [
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
        ? { key: 'moving', tone: 'done', title: moving, subtitle: 'Done', subtitleTone: 'muted' }
        : failed
          ? {
              key: 'moving',
              tone: 'failed',
              title: moving,
              subtitle: send?.failureReason || 'This didn’t go through. We’re looking into it.',
              subtitleTone: 'danger',
            }
          : {
              key: 'moving',
              tone: 'active',
              title: moving,
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
  }, [send, receipt, delivered, failed, status, fromChain, toChain]);

  if (delivered && send) {
    // What landed, when the tracker says; otherwise the amount that was quoted.
    const received = send.amountReceivedLD;
    const arrived =
      typeof received === 'string' && /^\d+$/.test(received)
        ? Number(formatUnits(BigInt(received), bridge.sentDecimals))
        : 0;
    return <SwappedView receipt={arrived > 0 ? { ...receipt, toAmount: arrived } : receipt} />;
  }

  return (
    <View className="flex-1 justify-between gap-8 pt-6">
      <View className="gap-6">
        <View className="items-center gap-3">
          <OutcomeIcon kind={failed ? 'failed' : 'moving'} />
          <Text className="text-center text-2xl font-semibold text-white">
            {failed ? 'Swap didn’t go through' : 'Swap on its way'}
          </Text>
          <Text className="text-center text-base text-white/70">
            {`${formatSwapAmount(receipt.fromAmount)} ${receipt.fromName} → ${formatSwapAmount(receipt.toAmount)} ${receipt.toName} on ${toChain}`}
          </Text>
        </View>
        <StepTracker steps={steps} />
        <Text className="text-center text-sm text-white/60">{trackerFootnote(failed)}</Text>
      </View>

      <Button variant="secondary" className="h-12 rounded-full" size="lg" onPress={close}>
        <Text className="text-base font-bold text-white">Done</Text>
      </Button>
    </View>
  );
};
