import { useEffect } from 'react';
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
import { findOffer, isTierOnTrial } from '@/lib/tierUpgrade';
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
 */
const UpgradeFundingStatus = () => {
  const { data: membership } = useTierMembership();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const tier = useTierUpgradeStore(state => state.tier);
  const back = useTierUpgradeStore(state => state.back);
  const close = useTierUpgradeStore(state => state.close);
  const offer = tier ? findOffer(membership, tier) : undefined;
  const feeUsd = offer?.annualFeeUsd ?? 0;
  const payment = useCashPayment({ membership, chain, feeUsd });
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
  // Read off the chain, not the swap: the balance poll is what says the USDC
  // is actually spendable, and it is what the charge will be taken from.
  const ready = funding.state === 'arrived' && payment.affordable;

  const handleFinish = async () => {
    if (!membership.contracts.subscriptionModuleAddress || offer.annualFeeUsd === null) return;
    track(TRACKING_EVENTS.TIER_SUBSCRIBE_PRESSED, {
      tier,
      price_usd: offer.annualFeeUsd,
      funded_from_chain_id: swap.fromChainId,
    });
    const result = await subscribe({
      tier,
      priceUsd: offer.annualFeeUsd,
      moduleAddress: membership.contracts.subscriptionModuleAddress,
      moduleEnabled: chain?.moduleEnabled ?? false,
      funding: { transactionHash: swap.txHash, fromChainId: swap.fromChainId },
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
