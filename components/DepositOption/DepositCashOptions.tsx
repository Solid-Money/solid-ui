import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { CARD_FUND_USD_ICON } from '@/components/Card/CardFund/constants';
import {
  CARD_FUND_LOCAL_CURRENCIES,
  getCardFundLocalPaymentMethods,
} from '@/components/Card/CardFund/localCurrencies';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useOrchestraConfig } from '@/hooks/useOrchestra';
import { useVirtualAccountEntry } from '@/hooks/useVirtualAccountEntry';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 36;
/** Matches the muted row text the "Show more" footer sits beside. */
const SHOW_MORE_ICON_COLOR = 'rgba(255,255,255,0.7)';
/**
 * USD is funded by the virtual account, which only takes ACH and wire. The
 * local currencies show their committed corridor list (localCurrencies.tsx).
 */
const USD_PAYMENT_METHOD_CHIPS = ['ACH', 'Wire'];
/** In the US the same row also leads to Cash App, so the chips say so. */
const USD_PAYMENT_METHOD_CHIPS_US = ['ACH', 'Wire', 'Cash App'];
const FEATURED_LOCAL_CURRENCY_CODES = ['EUR', 'BRL', 'BDT', 'PHP'] as const;
const ADDITIONAL_LOCAL_CURRENCY_CODES = ['MXN'] as const;

/**
 * How many currencies "Cash" accepts, USD included — the number the chooser's
 * icon cluster counts down from for its "+N" circle, so the two stay in step
 * when a corridor is added.
 */
export const DEPOSIT_CASH_CURRENCY_COUNT =
  1 + FEATURED_LOCAL_CURRENCY_CODES.length + ADDITIONAL_LOCAL_CURRENCY_CODES.length;

/** The flags the chooser's "Cash" row shows, in the order this screen lists them. */
export const DEPOSIT_CASH_CLUSTER_ICONS = [CARD_FUND_USD_ICON, getAsset('images/flag-eur.png')];

/**
 * "Deposit with cash" — the cash branch of the deposit chooser. USD opens the
 * virtual account (its own bank details, funded by ACH/wire); every other
 * currency opens the TransFi onramp preseeded with it.
 */
const DepositCashOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const resetTransfi = useTransfiStore(state => state.reset);
  const setTransfiCurrency = useTransfiStore(state => state.setFiatCurrency);

  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const { open: openVirtualAccount, isApplyOpen, closeApply } = useVirtualAccountEntry();
  // One rule, decided server-side: supported region **or** allowlisted. The
  // country is resolved here only because the backend has no geoip — the verdict
  // is still theirs, and they enforce it again on order creation.
  const { countryCode, isResolving: isResolvingCountry } = useCashAppDepositAvailability();
  const { data: orchestraConfig } = useOrchestraConfig(countryCode, !isResolvingCountry);
  const isCashAppAvailable = orchestraConfig?.isAvailable === true;
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress } = useBuyCryptoEntry();

  const localCurrencies = useMemo(() => {
    const visibleCodes = showAllCurrencies
      ? [...FEATURED_LOCAL_CURRENCY_CODES, ...ADDITIONAL_LOCAL_CURRENCY_CODES]
      : FEATURED_LOCAL_CURRENCY_CODES;

    return visibleCodes
      .map(code => CARD_FUND_LOCAL_CURRENCIES.find(currency => currency.code === code))
      .filter((currency): currency is (typeof CARD_FUND_LOCAL_CURRENCIES)[number] => !!currency);
  }, [showAllCurrencies]);

  const handleUsdPress = () => {
    // Two USD rails in the US, one everywhere else. Showing a chooser outside
    // the US would ask a question with a single answer, so USD goes straight to
    // the bank rail there — which is exactly what it did before Cash App
    // existed.
    if (isCashAppAvailable) {
      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_USD_METHOD);
      return;
    }
    openVirtualAccount();
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
      <CardFundGroup>
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
          chips={isCashAppAvailable ? USD_PAYMENT_METHOD_CHIPS_US : USD_PAYMENT_METHOD_CHIPS}
          onPress={handleUsdPress}
        />
        {localCurrencies.map(currency => (
          <CardFundRow
            key={currency.code}
            className="min-h-[93px]"
            icon={currency.icon}
            title={currency.code}
            chips={getCardFundLocalPaymentMethods(currency.code)}
            onPress={() => handleLocalCurrencyPress(currency.code)}
          />
        ))}
        {/* Owned here rather than by CardFundGroup's own footer: the toggle also
            decides which corridors are in the list at all, and so whether their
            payment methods are fetched. */}
        <Pressable
          className="h-[49px] flex-row items-center justify-center gap-x-2 web:hover:bg-card-hover"
          onPress={() => setShowAllCurrencies(current => !current)}
        >
          {showAllCurrencies ? (
            <Minus color={SHOW_MORE_ICON_COLOR} size={15} />
          ) : (
            <Plus color={SHOW_MORE_ICON_COLOR} size={15} />
          )}
          <Text className="text-sm font-medium text-white/70">
            {showAllCurrencies ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      </CardFundGroup>

      <VirtualAccountApplyDialog isOpen={isApplyOpen} onClose={closeApply} />
    </>
  );
};

export default DepositCashOptions;
