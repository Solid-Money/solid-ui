import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { ADDRESS_ZERO } from '@cryptoalgebra/fuse-sdk';
import { Wallet } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import MessageCircle from '@/assets/images/messages';
import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import BuyFuseTierCard from '@/components/Swap/BuyFuseTierCard';
import SwapButton from '@/components/Swap/SwapButton';
import SwapParams from '@/components/Swap/SwapParams';
import { Text } from '@/components/ui/text';
import { STABLECOINS_TOKENS } from '@/constants/tokens';
import { useRewardsUserData } from '@/hooks/useRewards';
import { useUSDCValue } from '@/hooks/useUSDCValue';
import {
  getBuyFuseProgress,
  getBuyFuseTierForAmount,
  getBuyFuseTierTargets,
  getNextBuyFuseTier,
  hasReachedFuseTarget,
} from '@/lib/buyFuseTiers';
import getTokenIcon from '@/lib/getTokenIcon';
import { RewardsTier } from '@/lib/types';
import { SwapField } from '@/lib/types/swap-field';
import { formatUSD } from '@/lib/utils';
import { useDerivedSwapInfo, useSwapActionHandlers, useSwapState } from '@/store/swapStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const formatBalance = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

const sanitizeAmount = (value: string) => {
  const normalized = value === '.' ? '0.' : value;
  const cleanValue = normalized.replace(/[^0-9.]/g, '');
  const parts = cleanValue.split('.');

  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanValue;
};

interface BuyFuseScreenProps {
  requestedTier?: RewardsTier;
}

export default function BuyFuseScreen({ requestedTier }: BuyFuseScreenProps) {
  const { data: rewardsData } = useRewardsUserData();

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

  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const balanceFuse = Math.max(0, rewardsData?.fuseSkipLine?.balanceFuse ?? 0);
  const targets = useMemo(
    () => getBuyFuseTierTargets(currentTier, rewardsData?.fuseSkipLine),
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
  const inputBalanceNumber = Number(inputBalance?.toSignificant(8) ?? 0) || 0;
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

  const handleTierPress = useCallback(() => {
    if (!selectedTarget) return;

    if (!reachedTarget) {
      onUserInput(SwapField.OUTPUT, String(selectedTarget.remainingFuse));
      return;
    }

    const nextTier = getNextBuyFuseTier(targets, selectedTarget.tier);
    const nextTarget = targets.find(target => target.tier === nextTier);
    if (!nextTarget) return;

    setSelectedTier(nextTarget.tier);
    onUserInput(SwapField.OUTPUT, String(nextTarget.remainingFuse));
  }, [onUserInput, reachedTarget, selectedTarget, targets]);

  const amountCard = (
    <View>
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="text-base font-medium text-white/70">Amount</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5">
            <Wallet size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.4} />
            <Text className="text-base font-medium text-white/50">
              {formatBalance(inputBalanceNumber)} USDC
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
    </View>
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="mx-auto w-full max-w-md flex-1 pb-4">
        {amountCard}

        <View className="mt-6">
          <BuyFuseTierCard
            currentTier={currentTier}
            target={selectedTarget}
            progressPct={progressPct}
            reached={reachedTarget}
            onPress={handleTierPress}
          />
        </View>

        <View className="min-h-[70px] flex-1" />

        <SwapParams label="Network fee" expandable={false} />

        <View className="mt-7">
          <SwapButton label="Continue" showSecurityIcon={false} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open support"
          onPress={() => openSupportDrawer()}
          className="mt-6 flex-row items-center justify-center gap-2 py-2 active:opacity-70"
        >
          <MessageCircle color="#FFFFFFB3" />
          <Text className="text-base font-medium text-white/70">Need help?</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
