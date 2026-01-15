import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Fuel } from 'lucide-react-native';

import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { formatNumber } from '@/lib/utils/utils';

import AmountCard from './AmountCard';
import ArrowDivider from './ArrowDivider';
import CryptoDropdown from './CryptoDropdown';
import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
  FIAT_LABEL,
  getMinimumAmount,
} from './enums';
import { ExchangeRateDisplay } from './ExchangeRateDisplay';
import FiatDropdown from './FiatDropdown';

export default function BankTransferAmount() {
  const [fiatAmount, setFiatAmount] = useState('1500');
  const [cryptoAmount, setCryptoAmount] = useState('1500');
  const [fiat, setFiat] = useState<BridgeTransferFiatCurrency>(BridgeTransferFiatCurrency.USD);
  const [crypto, setCrypto] = useState<BridgeTransferCryptoCurrency>(
    BridgeTransferCryptoCurrency.USDC,
  );
  const [isLimitsExpanded, setIsLimitsExpanded] = useState(false);

  const allowedCrypto = useMemo(() => {
    return [BridgeTransferCryptoCurrency.USDC];
  }, []);

  // Ensure crypto selection is valid when fiat changes
  useEffect(() => {
    if (!allowedCrypto.includes(crypto)) {
      setCrypto(BridgeTransferCryptoCurrency.USDC);
    }
  }, [allowedCrypto, crypto]);

  const { rate, loading } = useExchangeRate(fiat, crypto);

  useEffect(() => {
    if (!loading && rate) {
      // Use buy_rate when converting from fiat to crypto
      const fiatAmountFloat = fiatAmount ? parseFloat(fiatAmount) : 0;
      const buyRateFloat = rate.buy_rate ? parseFloat(rate.buy_rate) : 0;
      const newAmount = fiatAmountFloat * buyRateFloat;
      const newAmountSanitized = Number(newAmount.toFixed(2)).toString();
      setCryptoAmount(newAmountSanitized);
    }
  }, [fiatAmount, rate, loading]);

  const minimumAmountError = useMemo(() => {
    const minAmount = getMinimumAmount(fiat);
    if (!minAmount) return null;

    const amount = parseFloat(fiatAmount) || 0;
    if (amount < minAmount) {
      return `Minimum amount is ${minAmount} ${FIAT_LABEL[fiat]}`;
    }

    return null;
  }, [fiat, fiatAmount]);

  return (
    <View className="gap-4">
      <View>
        <View className="gap-3">
          <Text className="text-base font-medium text-white/70">You pay</Text>
          <AmountCard
            amount={fiatAmount}
            onChangeAmount={setFiatAmount}
            rightComponent={<FiatDropdown value={fiat} onChange={setFiat} />}
          />
        </View>

        <View className="mt-2">
          <ArrowDivider />
        </View>

        <View className="gap-3">
          <Text className="text-base font-medium text-white/70">You get</Text>
          <AmountCard
            amount={cryptoAmount}
            onChangeAmount={setCryptoAmount}
            rightComponent={
              <CryptoDropdown value={crypto} onChange={setCrypto} allowed={allowedCrypto} />
            }
          />
        </View>
      </View>

      <View className="mt-4">
        <Pressable
          className="flex-row items-center justify-between px-1"
          onPress={() => setIsLimitsExpanded(!isLimitsExpanded)}
        >
          <View className="flex-row items-center gap-2">
            <Fuel size={16} color="#A1A1A1" />
            <Text className="text-base font-medium text-white/70">Fee</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-white">0 {crypto.toUpperCase()}</Text>
            {isLimitsExpanded ? (
              <ChevronUp size={22} color="white" />
            ) : (
              <ChevronDown size={22} color="white" />
            )}
          </View>
        </Pressable>

        {isLimitsExpanded && (
          <View className="mt-4 overflow-hidden rounded-2xl bg-[#1C1C1C] py-2">
            <View className="flex-row items-center justify-between px-5 py-5">
              <Text className="text-base font-medium text-white/70">Ex rate</Text>
              <ExchangeRateDisplay
                rate={rate?.buy_rate}
                fromCurrency={fiat}
                toCurrency={crypto}
                loading={loading}
                initialLoading={loading && !rate}
              />
            </View>
            <View className="h-[1px] bg-white/10" />
            <View className="flex-row items-center justify-between px-5 py-5">
              <Text className="text-base font-medium text-white/70">Max limit self deposit</Text>
              <Text className="text-base font-semibold text-white">No limit</Text>
            </View>
            <View className="h-[1px] bg-white/10" />
            <View className="flex-row items-center justify-between px-5 py-5">
              <Text className="text-base font-medium text-white/70">Max limit third party</Text>
              <Text className="text-base font-semibold text-white">
                ${formatNumber(4000, 0, 0)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {minimumAmountError && (
        <Text className="text-center text-sm text-red-400">{minimumAmountError}</Text>
      )}

      <Button
        className="mt-4 h-14 rounded-2xl"
        style={{ backgroundColor: minimumAmountError ? '#4A4A4A' : '#94F27F' }}
        disabled={!!minimumAmountError}
        onPress={() => {
          router.push({
            pathname: '/bank-transfer/payment-method',
            params: {
              fiat,
              crypto,
              fiatAmount,
              cryptoAmount,
            },
          });
        }}
      >
        <Text
          className={`native:text-lg text-lg font-bold ${minimumAmountError ? 'text-gray-400' : 'text-black'}`}
        >
          Continue
        </Text>
      </Button>

      <View className="mt-4 items-center">
        <NeedHelp />
      </View>
    </View>
  );
}
