import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import AmountCard from './AmountCard';
import ArrowDivider from './ArrowDivider';
import CryptoDropdown from './CryptoDropdown';
import { BridgeTransferCryptoCurrency, BridgeTransferFiatCurrency } from './enums';
import FiatDropdown from './FiatDropdown';

export default function BankTransferAmount() {
  const [fiatAmount, setFiatAmount] = useState('1500');
  const [cryptoAmount, setCryptoAmount] = useState('1500');
  const [fiat, setFiat] = useState<BridgeTransferFiatCurrency>(BridgeTransferFiatCurrency.USD);
  const [crypto, setCrypto] = useState<BridgeTransferCryptoCurrency>(
    BridgeTransferCryptoCurrency.USDC,
  );

  const allowedCrypto = useMemo(() => {
    if (fiat === BridgeTransferFiatCurrency.EUR) {
      return [BridgeTransferCryptoCurrency.USDC];
    }
    return [BridgeTransferCryptoCurrency.USDC, BridgeTransferCryptoCurrency.USDT];
  }, [fiat]);

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

      <Button
        className="rounded-2xl h-14 mt-4"
        style={{ backgroundColor: '#94F27F' }}
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
        <Text className="font-bold text-black text-lg">Continue</Text>
      </Button>
    </View>
  );
}
