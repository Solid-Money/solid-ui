import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
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
      <AmountCard
        title="You pay"
        amount={fiatAmount}
        onChangeAmount={setFiatAmount}
        rightComponent={<FiatDropdown value={fiat} onChange={setFiat} />}
      />

      <ArrowDivider />

      <AmountCard
        title="You get"
        amount={cryptoAmount}
        onChangeAmount={setCryptoAmount}
        rightComponent={
          <CryptoDropdown value={crypto} onChange={setCrypto} allowed={allowedCrypto} />
        }
      />

      <View className="mt-4 gap-0.5 overflow-hidden rounded-2xl bg-[#1C1C1C]">
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-base text-[#ACACAC]">Ex rate</Text>
          <ExchangeRateDisplay
            rate={rate?.buy_rate}
            fromCurrency={fiat}
            toCurrency={crypto}
            loading={loading}
            initialLoading={loading && !rate}
          />
        </View>
        <View className="mx-5 h-[1px] bg-[#2C2C2C]" />
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-base text-[#ACACAC]">Max limit self deposit</Text>
          <Text className="text-base font-bold text-white">100000$</Text>
        </View>
        <View className="mx-5 h-[1px] bg-[#2C2C2C]" />
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-base text-[#ACACAC]">Max limit third party</Text>
          <Text className="text-base font-bold text-white">4000$</Text>
        </View>
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
          className={`text-lg font-bold ${minimumAmountError ? 'text-gray-400' : 'text-black'}`}
        >
          Continue
        </Text>
      </Button>

      <View className="items-center">
        <NeedHelp />
      </View>
    </View>
  );
}
