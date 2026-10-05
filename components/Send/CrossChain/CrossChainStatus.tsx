import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowUpRight, Check } from 'lucide-react-native';
import { fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { track } from '@/lib/analytics';
import { fetchCrossChainSend } from '@/lib/api/cross-chain-send';
import {
  CrossChainSendRecord,
  CrossChainSendStatus as SendStatus,
} from '@/lib/types/cross-chain-send';
import { cn, withRefreshToken } from '@/lib/utils';
import { formatLD, getExchangeDisplayName, isOwnWallet } from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import { BRAND } from './shared';

const TERMINAL: ReadonlySet<SendStatus> = new Set(['delivered', 'failed', 'stuck', 'expired']);
const DOT_SIZE = 28;

type StepTone = 'done' | 'active' | 'pending' | 'failed' | 'confirming';

type Step = {
  key: string;
  tone: StepTone;
  title: string;
  subtitle: string;
  subtitleTone?: 'brand' | 'muted' | 'danger';
  onSubtitlePress?: () => void;
};

const Dot = ({ tone }: { tone: StepTone }) => {
  const base = { width: DOT_SIZE, height: DOT_SIZE };
  if (tone === 'done') {
    return (
      <View className="items-center justify-center rounded-full bg-brand" style={base}>
        <Check size={16} color="black" strokeWidth={3} />
      </View>
    );
  }
  if (tone === 'failed') {
    return <View className="rounded-full bg-red-500" style={base} />;
  }
  if (tone === 'confirming') {
    return (
      <View className="items-center justify-center rounded-full border-2 border-brand" style={base}>
        <ActivityIndicator size="small" color={BRAND} />
      </View>
    );
  }
  if (tone === 'active') {
    return (
      <View className="items-center justify-center rounded-full border-2 border-brand" style={base}>
        <View className="h-2 w-2 rounded-full bg-brand" />
      </View>
    );
  }
  return <View className="rounded-full border-2 border-white/25" style={base} />;
};

const timeOf = (iso?: string) => (iso ? format(new Date(iso), 'HH:mm') : '');

/**
 * Screen 5 of the cross-chain send: a three-step tracker that polls the backend
 * until LayerZero delivers. Closing it is fine — the send carries on and the
 * activity row keeps the same id.
 */
const CrossChainStatus: React.FC = () => {
  const router = useRouter();
  const { crossChainSend, resetAll } = useSendStore(
    useShallow(state => ({
      crossChainSend: state.crossChainSend,
      resetAll: state.resetAll,
    })),
  );
  const { getExchange, getNetwork } = useCrossChainSendConfig();
  const { refetchAll } = useActivity();
  const sendId = crossChainSend?.sendId;

  const { data: polled } = useQuery({
    queryKey: ['cross-chain-send', sendId],
    queryFn: () => withRefreshToken(() => fetchCrossChainSend(sendId!)),
    enabled: !!sendId,
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status && TERMINAL.has(status) ? false : 5000;
    },
  });

  // The backend learns about the Fuse receipt from its own indexer; until then
  // our local record is the fresher one for the hash and the time it left.
  const record = useMemo((): CrossChainSendRecord | null => {
    if (!crossChainSend && !polled) return null;
    return {
      ...(crossChainSend ?? ({} as CrossChainSendRecord)),
      ...(polled ?? {}),
      srcTxHash: polled?.srcTxHash ?? crossChainSend?.srcTxHash,
      srcExplorerUrl: polled?.srcExplorerUrl ?? crossChainSend?.srcExplorerUrl,
      sentAt: polled?.sentAt ?? crossChainSend?.sentAt,
    };
  }, [crossChainSend, polled]);

  const exchange = getExchange(record?.exchange ?? null);
  const network = getNetwork(record?.dstChainId ?? null);
  const ownWallet = isOwnWallet(record?.exchange);
  const exchangeName = getExchangeDisplayName(exchange, record?.exchange);
  const networkName = network?.name ?? '';
  const status = record?.status;
  const isDelivered = status === 'delivered';
  const isFailed = status === 'failed' || status === 'expired';
  const isStuck = status === 'stuck';

  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || !record) return;
    viewedRef.current = true;
    track(TRACKING_EVENTS.CROSS_CHAIN_SEND_STATUS_VIEWED, {
      send_id: record.sendId,
      status: record.status,
      dst_chain_id: record.dstChainId,
      exchange: record.exchange,
    });
  }, [record]);

  const deliveredRef = useRef(false);
  useEffect(() => {
    if (!isDelivered || deliveredRef.current) return;
    deliveredRef.current = true;
    refetchAll();
  }, [isDelivered, refetchAll]);

  const openUrl = useCallback((url?: string) => {
    if (url) Linking.openURL(url);
  }, []);

  const steps = useMemo((): Step[] => {
    if (!record) return [];
    const srcUrl =
      record.srcExplorerUrl ??
      (record.srcTxHash ? `${fuse.blockExplorers.default.url}/tx/${record.srcTxHash}` : undefined);
    const sent: Step = record.sentAt
      ? {
          key: 'sent',
          tone: 'done',
          title: 'Sent from Fuse',
          subtitle: `${timeOf(record.sentAt)} · View transaction`,
          subtitleTone: 'brand',
          onSubtitlePress: () => openUrl(srcUrl),
        }
      : {
          key: 'sent',
          tone: 'confirming',
          title: 'Sent from Fuse',
          subtitle: 'Confirming…',
          subtitleTone: 'muted',
        };

    let bridging: Step;
    if (isDelivered) {
      bridging = {
        key: 'bridging',
        tone: 'done',
        title: `Bridging to ${networkName}`,
        subtitle: 'Done',
        subtitleTone: 'muted',
      };
    } else if (isFailed) {
      bridging = {
        key: 'bridging',
        tone: 'failed',
        title: `Bridging to ${networkName}`,
        subtitle:
          record.failureReason ||
          'The bridge didn’t go through. Nothing left your wallet if the Fuse transaction failed.',
        subtitleTone: 'danger',
      };
    } else if (isStuck) {
      bridging = {
        key: 'bridging',
        tone: 'active',
        title: `Bridging to ${networkName}`,
        subtitle: 'Taking longer than usual. We’re on it and will notify you.',
        subtitleTone: 'muted',
      };
    } else {
      bridging = {
        key: 'bridging',
        tone: record.sentAt ? 'active' : 'pending',
        title: `Bridging to ${networkName}`,
        subtitle: `About ${record.etaMinutes} min`,
        subtitleTone: 'muted',
      };
    }

    const arrived: Step = isDelivered
      ? {
          key: 'arrived',
          tone: 'done',
          title: `Arrived on ${networkName}`,
          subtitle: `${timeOf(record.deliveredAt)} · View transaction`,
          subtitleTone: 'brand',
          onSubtitlePress: () => openUrl(record.dstExplorerUrl),
        }
      : {
          key: 'arrived',
          tone: 'pending',
          title: `Arrived on ${networkName}`,
          subtitle: ownWallet
            ? 'We’ll notify you when it lands'
            : `We’ll notify you and show the transaction ID for ${exchangeName}`,
          subtitleTone: 'muted',
        };

    return [sent, bridging, arrived];
  }, [record, isDelivered, isFailed, isStuck, networkName, ownWallet, exchangeName, openUrl]);

  const handleViewActivity = useCallback(() => {
    if (sendId) {
      router.navigate(`/activity/${sendId}`, { dangerouslySingular: true });
    }
    resetAll();
  }, [router, sendId, resetAll]);

  if (!record) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-between gap-8 pt-2">
      <View className="gap-6">
        <View className="items-center gap-3">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(148,242,127,0.16)]">
            <ArrowUpRight size={32} color={BRAND} />
          </View>
          <Text className="text-center text-2xl font-semibold text-white">
            {ownWallet ? 'On its way to your wallet' : `On its way to ${exchangeName}`}
          </Text>
          <Text className="text-center text-base text-white/70">
            {formatLD(record.amountReceivedLD)} {record.token} · arrives on {networkName}
          </Text>
        </View>

        <View className="rounded-[15px] bg-card px-[18px] py-5">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const titleMuted = step.tone === 'pending';
            return (
              <View key={step.key} className="flex-row gap-3">
                <View className="items-center">
                  <Dot tone={step.tone} />
                  {!isLast ? (
                    <View
                      className={cn('w-[2px]', step.tone === 'done' ? 'bg-brand' : 'bg-white/15')}
                      style={{ height: 34 }}
                    />
                  ) : null}
                </View>
                <View className={cn('flex-1 gap-0.5', !isLast && 'pb-2')}>
                  <Text
                    className={cn(
                      'text-base font-semibold leading-6',
                      titleMuted ? 'text-white/50' : 'text-white',
                    )}
                  >
                    {step.title}
                  </Text>
                  <Pressable onPress={step.onSubtitlePress} disabled={!step.onSubtitlePress}>
                    <Text
                      className={cn(
                        'text-sm leading-[18px]',
                        step.subtitleTone === 'brand' && 'text-brand',
                        step.subtitleTone === 'danger' && 'text-red-400',
                        (!step.subtitleTone || step.subtitleTone === 'muted') && 'text-white/60',
                      )}
                    >
                      {step.subtitle}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <Text className="text-center text-sm text-white/60">
          You can close this screen. It keeps going in the background.
        </Text>
      </View>

      <View className="gap-3">
        <Pressable onPress={handleViewActivity} className="items-center py-2">
          <Text className="text-base font-medium text-white">View in Activity</Text>
        </Pressable>
        <Button variant="brand" className="h-12 rounded-full" size="lg" onPress={resetAll}>
          <Text className="text-base font-bold">Done</Text>
        </Button>
      </View>
    </View>
  );
};

export default CrossChainStatus;
