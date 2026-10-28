import React, { type ReactNode, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { CircleCheck, CircleX, ExternalLink } from 'lucide-react-native';

import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { formatNumber } from '@/lib/utils';
import { formatEta } from '@/lib/utils/swap/lifi';
import { TrackedLifiSwap, useLifiSwapStore } from '@/store/lifiSwapStore';

type StepState = 'done' | 'active' | 'failed' | 'waiting';

const StepIcon = ({ state }: { state: StepState }) => {
  if (state === 'done') return <CircleCheck size={22} color="#4ade80" />;
  if (state === 'failed') return <CircleX size={22} color="#f87171" />;
  if (state === 'active') return <ActivityIndicator size="small" color="#cccccc" />;
  return <View className="h-[22px] w-[22px] rounded-full border-2 border-white/20" />;
};

const Step = ({ state, title, detail }: { state: StepState; title: string; detail?: string }) => (
  <View className="flex-row items-center gap-3">
    <View className="w-6 items-center">
      <StepIcon state={state} />
    </View>
    <View className="flex-1">
      <Text className={state === 'waiting' ? 'text-muted-foreground' : 'font-medium'}>{title}</Text>
      {detail ? <Text className="text-sm text-muted-foreground">{detail}</Text> : null}
    </View>
  </View>
);

const headline = (swap: TrackedLifiSwap) => {
  if (swap.status === 'DONE') {
    if (swap.substatus === 'REFUNDED') return 'Swap refunded';
    if (swap.substatus === 'PARTIAL') return 'Swap delivered in another token';
    return 'Swap completed';
  }
  if (swap.status === 'FAILED' || swap.status === 'INVALID') return 'Swap failed';
  return 'Swap on its way';
};

const description = (swap: TrackedLifiSwap) => {
  const to = CHAIN_NAMES[swap.toChainId] ?? 'the destination network';
  if (swap.status === 'DONE') {
    if (swap.substatus === 'REFUNDED')
      return `The route could not complete and your ${swap.fromSymbol} was returned.`;
    if (swap.substatus === 'PARTIAL')
      return `The last swap on ${to} didn't go through, so you received ${swap.toSymbol} instead.`;
    return `Your ${swap.toSymbol} has arrived on ${to}.`;
  }
  if (swap.status === 'FAILED' || swap.status === 'INVALID')
    return (
      swap.substatusMessage ||
      'The swap could not be completed. Contact support if funds have not returned.'
    );
  return `Usually ${formatEta(swap.etaSeconds).replace('~', '')}. You can close this; we'll keep tracking it and update your activity.`;
};

/**
 * Progress of the cross-chain swap the user just sent, as the watcher learns it.
 *
 * `action` replaces the closing button for a flow that has a next step once
 * the swap lands — the tier upgrade, which starts the membership from here.
 */
const LifiSwapStatusView = ({ onDone, action }: { onDone?: () => void; action?: ReactNode }) => {
  const swap = useLifiSwapStore(state =>
    state.activeClientTxId ? state.swaps[state.activeClientTxId] : undefined,
  );
  const [isLeaving, setLeaving] = useState(false);

  if (!swap) return null;

  const from = CHAIN_NAMES[swap.fromChainId] ?? 'source';
  const to = CHAIN_NAMES[swap.toChainId] ?? 'destination';
  const failed = swap.status === 'FAILED' || swap.status === 'INVALID';
  const done = swap.status === 'DONE';

  const link = swap.receivingTxLink ?? swap.explorerLink ?? `https://scan.li.fi/tx/${swap.txHash}`;

  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text className="text-center text-2xl font-semibold">{headline(swap)}</Text>
        <Text className="text-center leading-5 text-muted-foreground">{description(swap)}</Text>
      </View>

      <View className="gap-5 rounded-2xl bg-accent p-5">
        <Step
          state="done"
          title={`Sent ${formatNumber(Number(swap.fromAmount))} ${swap.fromSymbol} on ${from}`}
        />
        <Step
          state={done ? 'done' : failed ? 'failed' : 'active'}
          title={`Bridging to ${to}`}
          detail={!done && !failed ? formatEta(swap.etaSeconds) : undefined}
        />
        <Step
          state={done ? 'done' : 'waiting'}
          title={`${done ? 'Received' : 'Receive'} ${formatNumber(Number(swap.toAmount))} ${swap.toSymbol} on ${to}`}
        />
      </View>

      <Pressable
        onPress={() => Linking.openURL(link)}
        className="flex-row items-center justify-center gap-2"
        accessibilityRole="link"
      >
        <Text className="text-sm font-medium text-muted-foreground">View on explorer</Text>
        <ExternalLink size={14} color="rgb(161, 161, 161)" />
      </Pressable>

      {action ?? (
        <Button
          variant="brand"
          className="h-12 w-full rounded-2xl"
          disabled={isLeaving}
          onPress={() => {
            setLeaving(true);
            onDone?.();
          }}
        >
          <Text className="w-full text-center text-base font-bold">View recent activity</Text>
        </Button>
      )}

      <NeedHelp />
    </View>
  );
};

export default LifiSwapStatusView;
