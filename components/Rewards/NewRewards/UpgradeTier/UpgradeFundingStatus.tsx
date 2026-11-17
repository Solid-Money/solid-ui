import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { KeyRound } from 'lucide-react-native';

import LifiSwapStatusView from '@/components/Swap/lifi/LifiSwapStatusView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  useSubscribeToTier,
  useTierMembership,
  useTierUpgradeChainState,
} from '@/hooks/useTierMembership';
import { markUpgradeFundingSpent, useCashPayment } from '@/hooks/useTierUpgradeFunding';
import { track } from '@/lib/analytics';
import { getTierDisplayName } from '@/lib/tierNames';
import {
  canPayCashFor,
  findOffer,
  formatUsd,
  isTierOnTrial,
  offerFirstYearFeeUsd,
  offerPaymentMode,
} from '@/lib/tierUpgrade';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

/**
 * A payment from another chain on its way to Fuse, and the second signature
 * once it is there.
 *
 * The progress is the swap screen's own, so a bridge reads the same here as it
 * does from the swap form. What changes is the button under it: the membership
 * is started from this screen as soon as the USDC lands, because waiting for
 * it is the only thing left between the user and the tier. A passkey prompt
 * needs a press, so it is a button rather than something that fires by itself.
 *
 * Closing is always safe. The swap keeps being tracked, and the offer step
 * picks the arrived USDC back up — with the bridge's cost still covered — the
 * next time the upgrade is opened.
 *
 * The second signature is whatever the offer is paid by: a mandate the backend
 * then charges, or — for an upgrade from a running membership — the transfer
 * batch and the upgrade endpoint. `useSubscribeToTier` reads that off the
 * offer, so this screen cannot start an upgrade the module would refuse.
 */
const UpgradeFundingStatus = () => {
  const { data: membership } = useTierMembership();
  const { data: chain, dataUpdatedAt: balancesReadAt } = useTierUpgradeChainState(
    membership?.contracts,
  );
  const tier = useTierUpgradeStore(state => state.tier);
  const back = useTierUpgradeStore(state => state.back);
  const close = useTierUpgradeStore(state => state.close);
  const selectToken = useTierUpgradeStore(state => state.selectToken);
  const offer = tier ? findOffer(membership, tier) : undefined;
  // The first year is what is charged now, and what has to have landed.
  const feeUsd = offerFirstYearFeeUsd(offer) ?? 0;
  const paymentMode = offer ? offerPaymentMode(offer) : undefined;
  const payment = useCashPayment({ membership, chain, feeUsd, paymentMode });
  const { funding } = payment;
  const { subscribe, isSubscribing, error } = useSubscribeToTier();
  const activeClientTxId = useLifiSwapStore(state => state.activeClientTxId);
  const setActive = useLifiSwapStore(state => state.actions.setActive);

  const swap = funding.state === 'none' ? undefined : funding.swap;

  // The status view shows whichever swap is active; this screen is about the
  // upgrade's, whatever the swap form last looked at.
  useEffect(() => {
    if (swap && activeClientTxId !== swap.clientTxId) setActive(swap.clientTxId);
  }, [swap, activeClientTxId, setActive]);

  // When this screen first saw the payment land. A shortfall is only believed
  // from a balance read after that: until the poll catches up, the USDC that
  // just landed is missing from the balance, and "short by the whole fee"
  // would be the wrong thing to say.
  const arrivedClientTxId = funding.state === 'arrived' ? funding.swap.clientTxId : undefined;
  const [arrival, setArrival] = useState<{ clientTxId: string; seenAt: number }>();
  useEffect(() => {
    if (arrivedClientTxId && arrival?.clientTxId !== arrivedClientTxId) {
      setArrival({ clientTxId: arrivedClientTxId, seenAt: Date.now() });
    }
  }, [arrivedClientTxId, arrival?.clientTxId]);
  const balanceReadSinceArrival =
    !!arrival && arrival.clientTxId === arrivedClientTxId && balancesReadAt > arrival.seenAt;

  if (!swap || !tier || !offer || !membership) {
    return (
      <View className="mx-auto w-full max-w-[414px]">
        <Text className="text-center text-[16px] leading-5 text-white/70">
          There is no payment on its way right now.
        </Text>
        <Button variant="brand" onPress={back} className="mt-6 h-14 rounded-full">
          <Text className="text-base font-bold text-black">Back</Text>
        </Button>
      </View>
    );
  }

  const keeping = isTierOnTrial(membership, tier);
  // An upgrade paid by transfer that is still unconfirmed has already taken
  // the USDC, so the balance can no longer vouch for it — and Finish is the
  // only way to confirm it. Pressed then, it confirms that payment and never
  // signs a new one, whatever the balance: a press that meant "finish" must
  // not turn into a second payment if the earlier one is gone by then.
  const confirmingEarlier = payment.awaitingConfirm;
  // Otherwise read off the chain, not the swap: the balance poll is what says
  // the USDC is actually spendable, and it is what the charge will be taken
  // from — whichever token the offer row names.
  const ready = confirmingEarlier || (funding.state === 'arrived' && payment.fuseCoversFee);
  // A transfer upgrade's payment that landed short stays short — nothing
  // covers its bridge — so the rest has to be sent, not waited for.
  const shortUsd =
    funding.state === 'arrived' && balanceReadSinceArrival ? payment.arrivedShortUsd : 0;

  const handleFinish = async () => {
    if (
      !membership.contracts.subscriptionModuleAddress ||
      offerFirstYearFeeUsd(offer) === null ||
      !canPayCashFor(offer, membership.contracts)
    ) {
      return;
    }
    track(TRACKING_EVENTS.TIER_SUBSCRIBE_PRESSED, {
      tier,
      price_usd: feeUsd,
      payment_mode: paymentMode,
      funded_from_chain_id: swap.fromChainId,
    });
    // The bridged transfer is passed either way; the hook claims the bridge
    // cover with it only for a module subscription.
    const result = await subscribe({
      offer,
      contracts: membership.contracts,
      moduleEnabled: chain?.moduleEnabled ?? false,
      funding: { transactionHash: swap.txHash, fromChainId: swap.fromChainId },
      confirmPendingOnly: confirmingEarlier,
    }).catch(() => null);
    if (!result) return;
    markUpgradeFundingSpent(swap.clientTxId);
    close();
  };

  const action =
    funding.state === 'failed' ? (
      <Button variant="brand" className="h-12 w-full rounded-2xl" onPress={back}>
        <Text className="w-full text-center text-base font-bold">Back to upgrade</Text>
      </Button>
    ) : shortUsd > 0 && !ready ? (
      <View className="gap-3">
        <Text className="text-center text-[14px] leading-5 text-white/50">
          {`Your USDC has landed, but you’re still ${formatUsd(
            Math.ceil(shortUsd * 100) / 100,
          )} short of the ${formatUsd(feeUsd)} fee. Add the rest to finish.`}
        </Text>
        <Button variant="brand" className="h-12 w-full rounded-2xl" onPress={selectToken}>
          <Text className="w-full text-center text-base font-bold text-black">Add the rest</Text>
        </Button>
      </View>
    ) : (
      <View className="gap-3">
        {error ? (
          <Text className="text-center text-[14px] leading-5 text-red-400">{error}</Text>
        ) : !ready ? (
          <Text className="text-center text-[14px] leading-5 text-white/50">
            {funding.state === 'arrived'
              ? 'Your USDC has landed. Checking your balance…'
              : `You can finish your ${getTierDisplayName(tier)} upgrade as soon as it lands.`}
          </Text>
        ) : null}
        <Button
          variant="brand"
          className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl"
          disabled={!ready || isSubscribing}
          onPress={() => void handleFinish()}
        >
          <KeyRound color="black" size={18} strokeWidth={2} />
          <Text className="text-base font-bold text-black">
            {isSubscribing
              ? keeping
                ? 'Confirming…'
                : 'Upgrading…'
              : keeping
                ? `Keep ${getTierDisplayName(tier)}`
                : 'Finish upgrade'}
          </Text>
        </Button>
      </View>
    );

  return <LifiSwapStatusView action={action} />;
};

export default UpgradeFundingStatus;
