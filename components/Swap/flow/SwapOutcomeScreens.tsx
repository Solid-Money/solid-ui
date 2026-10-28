import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, isToday } from 'date-fns';
import { ArrowUpRight, Check } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { BRAND, DetailCard, StepTracker, TrackerStep } from '@/components/Send/CrossChain/shared';
import { openSendWithReceived } from '@/components/Swap/flow/sendReceived';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { SWAP_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { formatSwapAmount, formatSwapUsd } from '@/lib/utils/swap/format';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { useSwapState } from '@/store/swapStore';

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
 * tracker as a cross-network send, fed by the LI.FI status watcher. Closing it
 * is fine; the watcher keeps going and the activity row follows.
 */
export const SwapOnItsWayScreen: React.FC = () => {
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
