import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus } from 'lucide-react-native';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import HomeQR from '@/assets/images/home-qr';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { CARD_FUND_USD_ICON } from '@/components/Card/CardFund/constants';
import { CARD_FUND_LOCAL_CURRENCIES } from '@/components/Card/CardFund/localCurrencies';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { useTransfiPaymentMethods } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

import { getPaymentMethodChips } from './depositPaymentMethods';
import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 36;
const FEATURED_LOCAL_CURRENCY_CODES = ['BRL', 'BDT', 'PHP'] as const;
const ADDITIONAL_LOCAL_CURRENCY_CODES = ['MXN'] as const;

const CryptoIcon = ({ children }: { children: React.ReactNode }) => (
  <View className="h-[37px] w-[37px] items-center justify-center rounded-full bg-[#333333]">
    {children}
  </View>
);

const DepositTypeSelection = () => {
  const { isDesktop } = useDimension();
  const setModal = useDepositStore(state => state.setModal);
  const resetTransfi = useTransfiStore(state => state.reset);
  const setTransfiCurrency = useTransfiStore(state => state.setFiatCurrency);
  const [isVirtualAccountApplyOpen, setIsVirtualAccountApplyOpen] = useState(false);
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress } = useBuyCryptoEntry();

  const { data: brlPaymentMethods } = useTransfiPaymentMethods('BRL');
  const { data: bdtPaymentMethods } = useTransfiPaymentMethods('BDT');
  const { data: phpPaymentMethods } = useTransfiPaymentMethods('PHP');
  const { data: mxnPaymentMethods } = useTransfiPaymentMethods(
    showAllCurrencies ? 'MXN' : undefined,
  );

  const paymentMethodChips = useMemo(
    () => ({
      BRL: getPaymentMethodChips(brlPaymentMethods),
      BDT: getPaymentMethodChips(bdtPaymentMethods),
      PHP: getPaymentMethodChips(phpPaymentMethods),
      MXN: getPaymentMethodChips(mxnPaymentMethods),
    }),
    [bdtPaymentMethods, brlPaymentMethods, mxnPaymentMethods, phpPaymentMethods],
  );

  const localCurrencies = useMemo(() => {
    const visibleCodes = showAllCurrencies
      ? [...FEATURED_LOCAL_CURRENCY_CODES, ...ADDITIONAL_LOCAL_CURRENCY_CODES]
      : FEATURED_LOCAL_CURRENCY_CODES;

    return visibleCodes
      .map(code => CARD_FUND_LOCAL_CURRENCIES.find(currency => currency.code === code))
      .filter((currency): currency is (typeof CARD_FUND_LOCAL_CURRENCIES)[number] => !!currency);
  }, [showAllCurrencies]);

  const handleCashPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'bank_transfer' });
    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    } else {
      setIsVirtualAccountApplyOpen(true);
    }
  };

  const handleShowAddressPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'deposit_directly' });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  const handleConnectWalletPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'wallet' });
    setModal(DEPOSIT_MODAL.OPEN_CONNECT_WALLET);
  };

  const handleLocalCurrencyPress = (code: string) => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
      currency: code,
    });
    resetTransfi();
    setTransfiCurrency(code);

    if (!isBuyCryptoAvailable) {
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
      return;
    }

    void handleBuyCryptoPress();
  };

  return (
    <>
      <View className="gap-y-8">
        <CardFundGroup label="Crypto deposit">
          <CardFundRow
            icon={
              <CryptoIcon>
                <HomeQR width={25} height={25} />
              </CryptoIcon>
            }
            title="Show deposit address"
            subtitle="Transfer from any wallet or exchange"
            onPress={handleShowAddressPress}
          />
          {isDesktop && (
            <CardFundRow
              icon={
                <CryptoIcon>
                  <FundExternalWallet width={26} height={26} />
                </CryptoIcon>
              }
              title="Connect wallet"
              subtitle="One-click deposit from 500+ wallets"
              onPress={handleConnectWalletPress}
            />
          )}
        </CardFundGroup>

        <CardFundGroup label="Cash deposit">
          <CardFundRow
            className="min-h-[93px]"
            icon={
              <Image
                source={CARD_FUND_USD_ICON}
                style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
                contentFit="cover"
              />
            }
            title="USD"
            chips={['ACH', 'Wire']}
            onPress={handleCashPress}
          />
          {localCurrencies.map(currency => (
            <CardFundRow
              key={currency.code}
              className="min-h-[93px]"
              icon={currency.icon}
              title={currency.code}
              chips={paymentMethodChips[currency.code as keyof typeof paymentMethodChips]}
              onPress={() => handleLocalCurrencyPress(currency.code)}
            />
          ))}
          <Pressable
            className="h-[49px] flex-row items-center justify-center gap-x-2 web:hover:bg-card-hover"
            onPress={() => setShowAllCurrencies(current => !current)}
          >
            {showAllCurrencies ? (
              <Minus color="rgba(255,255,255,0.7)" size={15} />
            ) : (
              <Plus color="rgba(255,255,255,0.7)" size={15} />
            )}
            <Text className="text-sm font-medium text-white/70">
              {showAllCurrencies ? 'Show less' : 'Show more'}
            </Text>
          </Pressable>
        </CardFundGroup>
      </View>

      <VirtualAccountApplyDialog
        isOpen={isVirtualAccountApplyOpen}
        onClose={() => setIsVirtualAccountApplyOpen(false)}
      />
    </>
  );
};

export default DepositTypeSelection;
