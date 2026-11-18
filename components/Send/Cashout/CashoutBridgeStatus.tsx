import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, XCircle } from 'lucide-react-native';
import { formatUnits, parseUnits } from 'viem';

import DepositStepper from '@/components/DepositStepper';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashoutUsdc } from '@/hooks/useCashout';
import { useTransfiCashoutConfig } from '@/hooks/useTransfiCashout';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import { fetchCrossChainSend } from '@/lib/api/cross-chain-send';
import { sanitizeTechnicalMessage } from '@/lib/errors';
import { CrossChainSendStatus } from '@/lib/types/cross-chain-send';
import { withRefreshToken } from '@/lib/utils';
import { formatLD } from '@/lib/utils/cross-chain-send';
import { DepositProgressRow } from '@/lib/utils/deposit-steps';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';

// Not 'stuck': a stuck send can still land, and only polling sees it here.
const TERMINAL: ReadonlySet<CrossChainSendStatus> = new Set(['delivered', 'failed', 'expired']);

const POLL_MS = 5000;
/** A stuck send is checked less often; it can take a while to clear. */
const STUCK_POLL_MS = 30_000;

/** How often the wallet balance is re-read while the landed USDC shows up in it. */
const BALANCE_REFRESH_MS = 4000;

/**
 * Step 1 of a cash-out topped up from Fuse: the move to the user's own Base
 * wallet, polled until it lands.
 *
 * Nothing has gone to the off-ramp provider yet, so closing is safe: the USDC
 * lands in the user's wallet either way and a new cash-out picks it up. Once it
 * has landed and the wallet shows it, this hands back to Review for step 2.
 */
export const CashoutBridgeStatus = () => {
  const router = useRouter();
  const setModal = useSendStore(state => state.setModal);
  const bridge = useCashoutStore(state => state.bridge);
  const usdcAmount = useCashoutStore(state => state.usdcAmount);
  const settleBridge = useCashoutStore(state => state.settleBridge);
  const reset = useCashoutStore(state => state.reset);
  const { data: config } = useTransfiCashoutConfig();
  const usdc = useCashoutUsdc(config?.chainId);
  const { refresh } = useWalletTokens();

  const network = config?.tokenNetwork ?? 'Base';
  const decimals = usdc.decimals ?? 6;
  const sendId = bridge?.sendId;

  const { data: send } = useQuery({
    queryKey: ['cross-chain-send', sendId],
    queryFn: () => withRefreshToken(() => fetchCrossChainSend(sendId!)),
    enabled: !!sendId,
    refetchInterval: query => {
      const status = query.state.data?.status;
      if (status && TERMINAL.has(status)) return false;
      return status === 'stuck' ? STUCK_POLL_MS : POLL_MS;
    },
  });

  const status = send?.status;
  const landed = status === 'delivered';
  const failed = status === 'failed' || status === 'expired';
  const stuck = status === 'stuck';

  // Landed: settle the amount once. The send's amountReceivedLD is the on-chain
  // figure by now; should it fall short of what the cash-out needed from Fuse,
  // the cash-out shrinks by the difference rather than failing on the balance.
  useEffect(() => {
    if (!landed || !send || !bridge || bridge.delivered) return;
    const shortBy = BigInt(bridge.shortfallLD) - BigInt(send.amountReceivedLD);
    const amountWei = parseUnits(usdcAmount, decimals);
    settleBridge(shortBy > 0n ? formatUnits(amountWei - shortBy, decimals) : usdcAmount);
    track(TRACKING_EVENTS.CASH_OUT_BRIDGE_DELIVERED, {
      send_id: send.sendId,
      amount_received_ld: send.amountReceivedLD,
      short_by_ld: shortBy > 0n ? shortBy.toString() : '0',
    });
  }, [landed, send, bridge, usdcAmount, decimals, settleBridge]);

  const failedRef = useRef(false);
  useEffect(() => {
    if (!failed || failedRef.current) return;
    failedRef.current = true;
    track(TRACKING_EVENTS.CASH_OUT_BRIDGE_FAILED, {
      send_id: sendId,
      status,
      // Sanitized like every error sent to analytics: the reason comes from the
      // backend and may quote a provider's error. Empty when there is none.
      error_message: sanitizeTechnicalMessage(send?.failureReason),
    });
  }, [failed, sendId, status, send?.failureReason]);

  // The wallet balance comes from an indexer that can trail the bridge by a few
  // seconds; Review checks the balance before it sends, so wait for it here.
  const settled = bridge?.delivered === true;
  const inWallet =
    settled && usdc.balanceWei != null && usdc.balanceWei >= parseUnits(usdcAmount, decimals);
  useEffect(() => {
    if (!settled || inWallet) return;
    refresh();
    const timer = setInterval(refresh, BALANCE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [settled, inWallet, refresh]);

  useEffect(() => {
    if (inWallet) setModal(SEND_MODAL.OPEN_CASHOUT_REVIEW);
  }, [inWallet, setModal]);

  const close = () => {
    reset();
    setModal(SEND_MODAL.CLOSE);
  };

  const moving = formatLD(bridge?.shortfallLD);
  // Keys are the stepper's own; only the labels are cash-out's.
  const rows: DepositProgressRow[] = [
    {
      key: 'received',
      label: `Move ${moving} USDC to ${network}`,
      state: landed ? 'complete' : failed ? 'failed' : 'active',
    },
    {
      key: 'confirmed',
      label: `Send ${usdcAmount} USDC to off-ramp provider`,
      state: 'pending',
    },
  ];

  if (failed) {
    return (
      <View className="items-center gap-6 px-2 py-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <XCircle size={48} color="#F87171" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold">
            The move to {network} didn’t go through
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {send?.failureReason ||
              'The bridge didn’t go through. Nothing left your wallet if the Fuse transaction failed.'}{' '}
            Nothing was sent to the off-ramp provider.
          </Text>
        </View>
        <DepositStepper rows={rows} className="w-full" />
        <View className="w-full gap-3">
          <Button
            className="h-12 rounded-2xl"
            variant="secondary"
            onPress={() => {
              close();
              router.push(path.ACTIVITY);
            }}
          >
            <Text className="text-base font-bold">View in Activity</Text>
          </Button>
          <Button className="h-12 rounded-2xl" variant="brand" onPress={close}>
            <Text className="text-base font-bold text-black">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <View className="items-center gap-2 pt-2">
        {landed ? (
          <View className="items-center justify-center rounded-full bg-card p-5">
            <Check size={40} color="#94F27F" />
          </View>
        ) : (
          <ActivityIndicator size="large" color="#94F27F" />
        )}
        <Text className="text-center text-2xl font-bold">
          {landed ? `${moving} USDC is on ${network}` : `Moving ${moving} USDC to ${network}`}
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          {landed
            ? 'Updating your balance…'
            : stuck
              ? 'Taking longer than usual. We’re on it and will notify you.'
              : `Usually about ${send?.etaMinutes ?? 2} min`}
        </Text>
      </View>

      <DepositStepper rows={rows} />

      <View className="flex-row items-start gap-2 px-1">
        <Info size={16} color="rgba(255,255,255,0.5)" />
        <Text className="flex-1 text-xs text-white/50">
          You can close this. Your USDC lands in your {network} wallet, and you can finish from Cash
          out.
        </Text>
      </View>

      <View className="gap-3">
        {settled ? (
          <Button
            className="h-12 rounded-2xl"
            variant="brand"
            onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_REVIEW)}
          >
            <Text className="text-base font-bold text-black">Continue</Text>
          </Button>
        ) : null}
        <Button className="h-12 rounded-2xl" variant="secondary" onPress={close}>
          <Text className="text-base font-bold">Close</Text>
        </Button>
      </View>
    </View>
  );
};

export default CashoutBridgeStatus;
