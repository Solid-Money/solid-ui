import { View } from 'react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getCryptoDepositEntry } from '@/lib/walletDepositFlow';
import { useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';

import { DEPOSIT_CASH_CLUSTER_ICONS, DEPOSIT_CASH_CURRENCY_COUNT } from './DepositCashOptions';
import DepositIconCluster from './DepositIconCluster';
import DepositMethodRow from './DepositMethodRow';

const DEPOSIT_CRYPTO_CLUSTER_ICONS = [
  getAsset('images/deposit-crypto-usdc.png'),
  getAsset('images/deposit-crypto-usdt.png'),
  getAsset('images/eth.png'),
];

type DepositTypeSelectionProps = {
  /** Dismisses the whole deposit flow — the drawer's own "Close" button. */
  onClose: () => void;
};

/**
 * "Deposit with" — the first step of the wallet deposit flow. The upgrade
 * Top up entry also offers Buy FUSE, while ordinary deposits keep the two
 * funding methods: crypto or cash.
 */
const DepositTypeSelection = ({ onClose }: DepositTypeSelectionProps) => {
  const { isDesktop, isScreenMedium } = useDimension();
  const setModal = useDepositStore(state => state.setModal);
  const resetDepositFlow = useDepositStore(state => state.resetDepositFlow);
  const upgradeTopUp = useDepositStore(state => state.upgradeTopUp);
  const { selectToken: selectSavingsFundToken } = useSavingsFundFlow();
  const openBuyFuse = useSwapState(state => state.actions.openBuyFuse);

  const handleCryptoPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'crypto' });
    if (upgradeTopUp?.depositToSavings) {
      useDepositStore.getState().setSavingsFundIntent('savings');
      selectSavingsFundToken('WFUSE');
      return;
    }
    setModal(getCryptoDepositEntry(isDesktop));
  };

  const handleCashPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'cash' });
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_CASH);
  };

  const handleBuyFusePress = () => {
    if (!upgradeTopUp) return;
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'buy_fuse' });
    const { tier, depositToSavings } = upgradeTopUp;
    resetDepositFlow();
    // The deposit drawer must finish leaving before the swap dialog mounts.
    setTimeout(() => openBuyFuse(tier, { depositToSavings }), 200);
  };

  return (
    <View className="gap-y-6">
      {/* The drawer carries its own header: a grab handle (small screens, where it
          is a real drag affordance) above a centred title, with no back or close
          control — this is the first step, and "Close" is the button below. */}
      <View className="gap-y-5">
        {!isScreenMedium ? (
          <View className="h-[5px] w-[73px] self-center rounded-full bg-white/20" />
        ) : null}
        <Text className="text-center text-xl font-semibold text-white">Deposit with</Text>
      </View>

      <CardFundGroup>
        <DepositMethodRow
          icon={<DepositIconCluster icons={DEPOSIT_CRYPTO_CLUSTER_ICONS} />}
          title="Crypto"
          subtitle="Transfer from any wallet or exchange"
          onPress={handleCryptoPress}
        />
        <DepositMethodRow
          icon={
            <DepositIconCluster
              icons={DEPOSIT_CASH_CLUSTER_ICONS}
              overflowCount={DEPOSIT_CASH_CURRENCY_COUNT - DEPOSIT_CASH_CLUSTER_ICONS.length}
            />
          }
          title="Cash"
          subtitle="Transfer from your bank account or with local ramps"
          onPress={handleCashPress}
        />
        {upgradeTopUp ? (
          <DepositMethodRow
            icon={<DepositIconCluster icons={[getAsset('images/wfuse.png')]} />}
            title="Buy FUSE"
            subtitle="Buy with USDC on Fuse"
            onPress={handleBuyFusePress}
          />
        ) : null}
      </CardFundGroup>

      <Button
        variant="brand"
        className="h-12 w-full rounded-full"
        onPress={onClose}
        // The drawer has no close control of its own, so this is the only way out
        // for a screen reader that never reaches the backdrop.
        accessibilityLabel="Close"
      >
        <Text className="text-base font-bold text-black">Close</Text>
      </Button>
    </View>
  );
};

export default DepositTypeSelection;
