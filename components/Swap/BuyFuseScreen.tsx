import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADDRESS_ZERO } from '@cryptoalgebra/fuse-sdk';
import { Wallet } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import MessageCircle from '@/assets/images/messages';
import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import BuyFuseSavingsReview from '@/components/Swap/BuyFuseSavingsReview';
import BuyFuseTierCard from '@/components/Swap/BuyFuseTierCard';
import SwapButton from '@/components/Swap/SwapButton';
import SwapParams from '@/components/Swap/SwapParams';
import { Text } from '@/components/ui/text';
import { SWAP_MODAL } from '@/constants/modals';
import { STABLECOINS_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useUSDCValue } from '@/hooks/useUSDCValue';
import { formatBuyFuseFundingBalance } from '@/lib/buyFuseFunding';
import {
  getBuyFuseProgress,
  getBuyFuseTierForAmount,
  getBuyFuseTierTargets,
  getNextBuyFuseTier,
  hasReachedFuseTarget,
} from '@/lib/buyFuseTiers';
import getTokenIcon from '@/lib/getTokenIcon';
import { isHigherTier } from '@/lib/rewardsUpgrade';
import { RewardsTier } from '@/lib/types';
import { SwapField } from '@/lib/types/swap-field';
import { formatUSD } from '@/lib/utils';
import { useDerivedSwapInfo, useSwapActionHandlers, useSwapState } from '@/store/swapStore';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';
import { useUserStore } from '@/store/useUserStore';

const MINIMUM_FUSE_SAVINGS_DEPOSIT = Number(
  VAULTS.find(vault => vault.name === 'FUSE')?.minimumAmount ?? 0,
);

const sanitizeAmount = (value: string) => {
  const normalized = value === '.' ? '0.' : value;
  const cleanValue = normalized.replace(/[^0-9.]/g, '');
  const parts = cleanValue.split('.');

  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanValue;
};

interface BuyFuseScreenProps {
  requestedTier?: RewardsTier;
}

export default function BuyFuseScreen(props: BuyFuseScreenProps) {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  return <BuyFuseForAccount key={userId ?? 'none'} {...props} />;
}

function BuyFuseForAccount({ requestedTier }: BuyFuseScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: rewardsData, isError } = useRewardsUserData();
  const confirmed = useRewardsUpgradeStore(state => state.confirmed);
  const pending = useRewardsUpgradeStore(state => !!state.pendingUntil && state.savingsConfirmed);
  const [purchased, setPurchased] = useState(false);

  const { independentField, typedValue, selectCurrency, typeInput, resetForm } = useSwapState(
    useShallow(state => ({
      independentField: state.independentField,
      typedValue: state.typedValue,
      selectCurrency: state.actions.selectCurrency,
      typeInput: state.actions.typeInput,
      resetForm: state.actions.resetForm,
    })),
  );
  const { onUserInput } = useSwapActionHandlers();
  const {
    currencyBalances,
    parsedAmount,
    toggledTrade: trade,
    voltageTrade,
    isVoltageTrade,
    isVoltageTradeLoading,
    tradeState,
  } = useDerivedSwapInfo();

  useEffect(() => {
    selectCurrency(SwapField.INPUT, STABLECOINS_TOKENS.USDC.address);
    selectCurrency(SwapField.OUTPUT, ADDRESS_ZERO);
    typeInput(SwapField.OUTPUT, '');

    return () => resetForm();
  }, [resetForm, selectCurrency, typeInput]);

  const currentTier = isError ? undefined : confirmed?.currentTier;
  const balanceFuse = Math.max(0, rewardsData?.fuseSkipLine?.balanceFuse ?? 0);
  const targets = useMemo(
    () => (currentTier ? getBuyFuseTierTargets(currentTier, rewardsData?.fuseSkipLine) : []),
    [currentTier, rewardsData?.fuseSkipLine],
  );
  const [selectedTier, setSelectedTier] = useState<RewardsTier | undefined>(requestedTier);

  useEffect(() => {
    if (!targets.some(target => target.tier === selectedTier)) {
      setSelectedTier(targets[0]?.tier);
    }
  }, [selectedTier, targets]);

  const selectedTarget =
    targets.find(target => target.tier === selectedTier) ?? targets[0] ?? undefined;
  const staleRequest =
    !!requestedTier && !!currentTier && !isHigherTier(requestedTier, currentTier);
  const canBuy = !!currentTier && !isError && !pending && !staleRequest && !!selectedTarget;
  const selectedTrade = isVoltageTrade ? voltageTrade.trade : trade;
  const outputAmount =
    independentField === SwapField.OUTPUT ? parsedAmount : selectedTrade?.outputAmount;
  const enteredFuse = Math.max(
    0,
    Number(outputAmount?.toExact() ?? (independentField === SwapField.OUTPUT ? typedValue : 0)) ||
      0,
  );
  const reachedTarget = selectedTarget
    ? hasReachedFuseTarget(enteredFuse, selectedTarget.remainingFuse)
    : true;
  const progressPct = selectedTarget
    ? getBuyFuseProgress(balanceFuse, enteredFuse, selectedTarget.requiredFuse)
    : 100;

  const inputBalance = currencyBalances[SwapField.INPUT];
  const fundingBalanceLabel = formatBuyFuseFundingBalance(inputBalance?.toSignificant(8));
  const canUseMax = Boolean(inputBalance?.greaterThan(0));
  const isOutputLoading =
    independentField === SwapField.INPUT &&
    (isVoltageTradeLoading || tradeState.state === 'LOADING');
  const displayedAmount =
    independentField === SwapField.OUTPUT
      ? typedValue
      : isOutputLoading
        ? '...'
        : (outputAmount?.toSignificant(8) ?? '');
  const { formatted: fuseUsdValue } = useUSDCValue(outputAmount);

  const handleAmountChange = useCallback(
    (value: string) => {
      const sanitizedAmount = sanitizeAmount(value);
      onUserInput(SwapField.OUTPUT, sanitizedAmount);
      setSelectedTier(getBuyFuseTierForAmount(targets, Number(sanitizedAmount) || 0));
    },
    [onUserInput, targets],
  );

  const handleMax = useCallback(() => {
    if (inputBalance) onUserInput(SwapField.INPUT, inputBalance.toExact());
  }, [inputBalance, onUserInput]);

  const handleSupportPress = useCallback(() => {
    useSwapState.getState().actions.setModal(SWAP_MODAL.CLOSE);
    openSupportDrawer();
  }, []);

  const handleTierPress = useCallback(() => {
    if (!selectedTarget) return;

    if (!reachedTarget || enteredFuse < MINIMUM_FUSE_SAVINGS_DEPOSIT) {
      onUserInput(
        SwapField.OUTPUT,
        String(Math.max(selectedTarget.remainingFuse, MINIMUM_FUSE_SAVINGS_DEPOSIT)),
      );
      return;
    }

    const nextTier = getNextBuyFuseTier(targets, selectedTarget.tier);
    const nextTarget = targets.find(target => target.tier === nextTier);
    if (!nextTarget) return;

    setSelectedTier(nextTarget.tier);
    onUserInput(
      SwapField.OUTPUT,
      String(Math.max(nextTarget.remainingFuse, MINIMUM_FUSE_SAVINGS_DEPOSIT)),
    );
  }, [onUserInput, reachedTarget, selectedTarget, targets, enteredFuse]);

  const amountCard = (
    <View>
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <Text className="text-base font-medium text-white/70">Amount</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5">
            <Wallet size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.4} />
            <Text className="text-base font-medium text-white/50">
              {fundingBalanceLabel} USDC on Fuse
            </Text>
          </View>
          {canUseMax && <Max onPress={handleMax} />}
        </View>
      </View>

      <View className="h-[80px] flex-row items-center rounded-[15px] bg-[#1C1C1C] px-4">
        <View className="mr-3 flex-1">
          <TextInput
            accessibilityLabel="FUSE amount"
            value={displayedAmount}
            onChangeText={handleAmountChange}
            placeholder="0.0"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="decimal-pad"
            className="p-0 text-3xl font-semibold text-white web:focus:outline-none"
            style={{ fontFamily: 'MonaSans_600SemiBold' }}
          />
          <Text className="text-base font-medium text-white/50">
            {fuseUsdValue && fuseUsdValue > 0 ? formatUSD(fuseUsdValue) : '$0'}
          </Text>
        </View>

        <View className="h-12 flex-row items-center gap-2 rounded-full bg-white/10 px-3">
          <RenderTokenIcon tokenIcon={getTokenIcon({ tokenSymbol: 'FUSE' })} size={30} />
          <Text className="text-lg font-semibold text-white">FUSE</Text>
        </View>
      </View>

      <Text className="mt-3 px-1 text-sm font-medium text-white/50">
        USDC on other networks, including Ethereum, can’t be used directly here.
      </Text>
    </View>
  );

  if (purchased) return <BuyFuseSavingsReview />;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        className="mx-auto w-full max-w-md"
        style={{ flexGrow: 1, paddingBottom: 16 + Math.max(insets.bottom, 32) }}
      >
        {amountCard}

        <View className="mt-6">
          {currentTier && !isError && (selectedTarget || currentTier === RewardsTier.ULTRA) ? (
            <BuyFuseTierCard
              currentTier={currentTier}
              target={selectedTarget}
              progressPct={progressPct}
              reached={reachedTarget}
              onPress={handleTierPress}
            />
          ) : (
            <Text className="text-white/70">
              {isError
                ? 'Unable to confirm your tier. Please try again.'
                : 'Checking available tier upgrades…'}
            </Text>
          )}
          <Text className="mt-3 text-sm text-white/70">
            {pending
              ? 'Your Savings deposit is confirmed. Waiting for rewards to confirm your tier.'
              : staleRequest
                ? 'Your tier has changed. Reopen Buy FUSE to choose a higher tier.'
                : 'Step 1: Buy FUSE for your wallet. Step 2: Review and confirm a separate Savings deposit. Progress shown is an estimate until rewards confirms your tier.'}
          </Text>
        </View>

        {MINIMUM_FUSE_SAVINGS_DEPOSIT > 0 && (
          <Text className="mt-2 text-sm text-white/70">
            Savings minimum deposit: {MINIMUM_FUSE_SAVINGS_DEPOSIT.toLocaleString('en-US')} FUSE.
          </Text>
        )}
        <View className="min-h-6 flex-1" />

        <SwapParams label="Network fee" expandable={false} />

        <View className="mt-7">
          <SwapButton
            label="Buy FUSE"
            showSecurityIcon={false}
            disabled={!canBuy}
            onConfirmed={() => setPurchased(true)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open support"
          onPress={handleSupportPress}
          className="mt-3 flex-row items-center justify-center gap-2 py-2 active:opacity-70"
        >
          <MessageCircle color="#FFFFFFB3" />
          <Text className="text-base font-medium text-white/70">Need help?</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
