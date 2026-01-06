import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useDepositStore } from '@/store/useDepositStore';
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
import { PaymentMethodList } from './payment/PaymentMethodList';

// Modal version of BankTransferAmount
const BankTransferAmountModal = () => {
  const { bankTransfer, setBankTransferData, setModal } = useDepositStore();

  const [fiatAmount, setFiatAmount] = useState(bankTransfer.fiatAmount || '1500');
  const [cryptoAmount, setCryptoAmount] = useState(bankTransfer.cryptoAmount || '1500');
  const [fiat, setFiat] = useState<BridgeTransferFiatCurrency>(
    bankTransfer.fiat || BridgeTransferFiatCurrency.USD,
  );
  const [crypto, setCrypto] = useState<BridgeTransferCryptoCurrency>(
    bankTransfer.crypto || BridgeTransferCryptoCurrency.USDC,
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

  const handleContinue = () => {
    setBankTransferData({
      fiatAmount,
      cryptoAmount,
      fiat,
      crypto,
    });
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PAYMENT);
  };

  return (
    <View className="gap-4">
      <AmountCard
        title="You pay"
        amount={fiatAmount}
        onChangeAmount={setFiatAmount}
        rightComponent={<FiatDropdown value={fiat} onChange={setFiat} />}
        isModal={true}
      />

      <ArrowDivider />

      <AmountCard
        title="You get"
        amount={cryptoAmount}
        onChangeAmount={setCryptoAmount}
        rightComponent={
          <CryptoDropdown value={crypto} onChange={setCrypto} allowed={allowedCrypto} />
        }
        isModal={true}
      />

      <ExchangeRateDisplay
        rate={rate?.buy_rate}
        fromCurrency={fiat}
        toCurrency={crypto}
        loading={loading}
        initialLoading={loading && !rate}
      />

      {minimumAmountError && (
        <Text className="text-center text-sm text-red-400">{minimumAmountError}</Text>
      )}

      <Button
        className="mt-4 h-14 rounded-2xl"
        style={{ backgroundColor: minimumAmountError ? '#4A4A4A' : '#94F27F' }}
        disabled={!!minimumAmountError}
        onPress={handleContinue}
      >
        <Text
          className={`text-lg font-bold ${minimumAmountError ? 'text-gray-400' : 'text-black'}`}
        >
          Continue
        </Text>
      </Button>
    </View>
  );
};

// Modal version of PaymentMethodList
const BankTransferPaymentMethodModal = () => {
  const { bankTransfer } = useDepositStore();

  return (
    <View className="gap-4">
      <PaymentMethodList
        fiat={bankTransfer.fiat}
        crypto={bankTransfer.crypto}
        fiatAmount={bankTransfer.fiatAmount}
        isModal={true}
      />
    </View>
  );
};

// Modal version of Preview
const BankTransferPreviewModal = () => {
  const { bankTransfer, setModal } = useDepositStore();
  const data = bankTransfer.instructions;

  const Row = ({
    label,
    value,
    withDivider = false,
  }: {
    label: string;
    value: string;
    withDivider?: boolean;
  }) => (
    <View>
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-base text-gray-400">{label}</Text>
        <Text className="text-base font-medium text-white">{value}</Text>
      </View>
      {withDivider && <View className="mx-4 h-[1px] bg-[#2C2C2C]" />}
    </View>
  );

  const PreviewTitle = ({ amount, currency }: { amount?: string; currency?: string }) => (
    <View className="mb-4 items-center gap-2">
      <Text className="text-3xl font-bold text-white">
        {amount} {currency?.toUpperCase()}
      </Text>
      <Text className="text-base text-gray-400">Transfer details</Text>
    </View>
  );

  const isSepa = data?.payment_rail === 'sepa';
  const isSpei = data?.payment_rail === 'spei';

  const getAccountNumber = () => {
    if (isSepa) return data?.iban;
    if (isSpei) return data?.clabe;
    return data?.bank_account_number;
  };

  const getAccountLabel = () => {
    if (isSepa) return 'IBAN';
    if (isSpei) return 'CLABE';
    return 'Account number';
  };

  const accountNumber = getAccountNumber();
  const routingCode = isSepa ? data?.bic : data?.bank_routing_number;
  const beneficiaryName =
    isSepa || isSpei ? data?.account_holder_name : data?.bank_beneficiary_name;

  return (
    <View className="flex-1 gap-4">
      <PreviewTitle amount={data?.amount} currency={data?.currency} />

      <View className="mt-6 overflow-hidden rounded-2xl bg-[#1C1C1C]">
        <Row
          label="Amount"
          value={`${data?.amount ?? ''} ${data?.currency?.toUpperCase() ?? ''}`}
          withDivider
        />
        <Row label="Bank Name" value={data?.bank_name ?? ''} withDivider />
        <Row label={getAccountLabel()} value={accountNumber ?? ''} withDivider />
        {routingCode && (
          <Row label={isSepa ? 'BIC' : 'Routing / SWIFT / BIC'} value={routingCode} withDivider />
        )}
        <Row label="Beneficiary name" value={beneficiaryName ?? ''} withDivider />
        <Row label="Deposit message" value={data?.deposit_message ?? ''} />
      </View>

      <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
        <Row label="Status" value={'Waiting for transfer'} />
      </View>

      <Button
        className="mt-auto h-14 rounded-2xl sm:mt-8"
        style={{ backgroundColor: '#94F27F' }}
        onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
      >
        <Text className="text-lg font-bold text-black">Done</Text>
      </Button>
    </View>
  );
};

// Main component that renders the appropriate step
export const BankTransferModalContent = () => {
  const { currentModal } = useDepositStore();

  if (currentModal.name === 'open_bank_transfer_amount') {
    return <BankTransferAmountModal />;
  }

  if (currentModal.name === 'open_bank_transfer_payment') {
    return <BankTransferPaymentMethodModal />;
  }

  if (currentModal.name === 'open_bank_transfer_preview') {
    return <BankTransferPreviewModal />;
  }

  return null;
};
