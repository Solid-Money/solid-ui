import { useState } from 'react';
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
import { getUsdMethodChips } from '@/components/DepositOption/DepositUsdOptions';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoEntry } from '@/hooks/useBuyCryptoEntry';
import { useHasFeature } from '@/hooks/useFeatureAccess';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useIsCashAppAvailable } from '@/hooks/useOrchestra';
import { useTransfiCountryAvailability } from '@/hooks/useTransfiCountryAvailability';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { canFundByUsdBankTransfer } from '@/lib/utils/cardHelpers';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

const ICON_SIZE = 36;
/** Matches the muted row text the "Show more" footer sits beside. */
const SHOW_MORE_ICON_COLOR = 'rgba(255,255,255,0.7)';
const FEATURED_LOCAL_CURRENCY_CODES: readonly string[] = ['EUR', 'BRL', 'BDT', 'PHP'];

/** The featured corridors, in the order the design puts them on the first screen. */
const FEATURED_LOCAL_CURRENCIES = FEATURED_LOCAL_CURRENCY_CODES.map(code =>
  CARD_FUND_LOCAL_CURRENCIES.find(currency => currency.code === code),
).filter((currency): currency is (typeof CARD_FUND_LOCAL_CURRENCIES)[number] => !!currency);

/**
 * "Show more" lists every other corridor in localCurrencies.tsx, so a new one
 * appears here without touching this screen.
 */
const ALL_LOCAL_CURRENCIES = [
  ...FEATURED_LOCAL_CURRENCIES,
  ...CARD_FUND_LOCAL_CURRENCIES.filter(
    currency => !FEATURED_LOCAL_CURRENCY_CODES.includes(currency.code),
  ),
];

/**
 * How many currencies "Cash" accepts, USD included — the number the chooser's
 * icon cluster counts down from for its "+N" circle, so the two stay in step
 * when a corridor is added.
 */
export const DEPOSIT_CASH_CURRENCY_COUNT = 1 + ALL_LOCAL_CURRENCIES.length;

/** The flags the chooser's "Cash" row shows, in the order this screen lists them. */
export const DEPOSIT_CASH_CLUSTER_ICONS = [CARD_FUND_USD_ICON, getAsset('images/flag-eur.png')];

/**
 * "Deposit with cash" — the cash branch of the deposit chooser. USD opens its
 * methods (the virtual account's ACH/wire, Credit card, and Cash App in the US);
 * every other currency opens the TransFi onramp preseeded with it.
 */
const DepositCashOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const resetTransfi = useTransfiStore(state => state.reset);
  const setTransfiCurrency = useTransfiStore(state => state.setFiatCurrency);

  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const isCashAppAvailable = useIsCashAppAvailable();
  const hasCreditCard = useHasFeature('onramper');
  const { provider: virtualAccountProvider } = useVirtualAccountProvider();
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress } = useBuyCryptoEntry();
  // The local currencies are all TransFi; USD is not, so it stays.
  const { isAvailable: isTransfiAvailable } = useTransfiCountryAvailability();

  const localCurrencies = showAllCurrencies ? ALL_LOCAL_CURRENCIES : FEATURED_LOCAL_CURRENCIES;

  // USD opens the chooser of its methods. The bank rail is usually there, but
  // a Wirex-issued virtual account has no bank rail and Credit card is for
  // whitelisted users only, so outside the US (no Cash App) USD can have none —
  // and then its row is hidden rather than opening an empty chooser. Keyed on
  // the virtual account, not the card: a Wirex CARDHOLDER is routed to a Rain
  // account, which does have the rail.
  const usdMethodChips = getUsdMethodChips({
    hasBankTransfer: canFundByUsdBankTransfer(virtualAccountProvider),
    hasCreditCard,
    hasCashApp: isCashAppAvailable,
  });

  const handleUsdPress = () => {
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_USD_METHOD);
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
    <CardFundGroup>
      {usdMethodChips.length > 0 ? (
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
          chips={usdMethodChips}
          onPress={handleUsdPress}
        />
      ) : null}
      {isTransfiAvailable
        ? localCurrencies.map(currency => (
            <CardFundRow
              key={currency.code}
              className="min-h-[93px]"
              icon={currency.icon}
              title={currency.code}
              chips={getCardFundLocalPaymentMethods(currency.code)}
              onPress={() => handleLocalCurrencyPress(currency.code)}
            />
          ))
        : null}
      {/* Owned here rather than by CardFundGroup's own footer: the toggle
          switches between two lists rather than revealing hidden rows. */}
      {isTransfiAvailable ? (
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
      ) : null}
    </CardFundGroup>
  );
};

export default DepositCashOptions;
