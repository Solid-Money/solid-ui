import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus, Zap } from 'lucide-react-native';

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
import { useCardStatus } from '@/hooks/useCardStatus';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { useTransfiPaymentMethods } from '@/hooks/useTransfi';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { RainApplicationStatus, TransfiPaymentMethodOption } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useOrchestraStore } from '@/store/useOrchestraStore';
import { useTransfiStore } from '@/store/useTransfiStore';

import { getPaymentMethodChips } from './depositPaymentMethods';
import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 36;
/** Matches the muted row text the "Show more" footer sits beside. */
const SHOW_MORE_ICON_COLOR = 'rgba(255,255,255,0.7)';
/**
 * USD is funded by the virtual account, which only takes ACH and wire — unlike
 * the local currencies, whose rails come back from TransFi's payment config.
 */
const USD_PAYMENT_METHOD_CHIPS = ['ACH', 'Wire'];
/**
 * The Lightning onramp is a payment method rather than a currency, so it sits
 * under the rail the user recognises. Cash App is named because it is the one
 * the pay link launches directly; any Lightning wallet takes the same invoice.
 */
const LIGHTNING_PAYMENT_METHOD_CHIPS = ['Lightning', 'Instant'];
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
  const resetOrchestra = useOrchestraStore(state => state.reset);
  const setTransfiCurrency = useTransfiStore(state => state.setFiatCurrency);
  const [isVirtualAccountApplyOpen, setIsVirtualAccountApplyOpen] = useState(false);
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);
  const { provider: virtualAccountProvider } = useVirtualAccountProvider();
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress } = useBuyCryptoEntry();

  const { data: eurPaymentMethods } = useTransfiPaymentMethods('EUR');
  const { data: brlPaymentMethods } = useTransfiPaymentMethods('BRL');
  const { data: bdtPaymentMethods } = useTransfiPaymentMethods('BDT');
  const { data: phpPaymentMethods } = useTransfiPaymentMethods('PHP');
  const { data: mxnPaymentMethods } = useTransfiPaymentMethods(
    showAllCurrencies ? 'MXN' : undefined,
  );

  /**
   * Rails to show on a currency's row.
   *
   * TransFi's payment config is the live answer, but it is a request that can be
   * pending, geo-refused or simply unavailable, and a row with no chips reads as
   * a currency with no way to pay for it. So the committed corridor list is the
   * baseline — the same one the card funding screen shows — and the live config
   * replaces it once it arrives.
   */
  const paymentMethodChips = useMemo(() => {
    const resolve = (code: string, methods: TransfiPaymentMethodOption[] | undefined) => {
      const live = getPaymentMethodChips(methods);
      return live.length ? live : getCardFundLocalPaymentMethods(code);
    };

    return {
      EUR: resolve('EUR', eurPaymentMethods),
      BRL: resolve('BRL', brlPaymentMethods),
      BDT: resolve('BDT', bdtPaymentMethods),
      PHP: resolve('PHP', phpPaymentMethods),
      MXN: resolve('MXN', mxnPaymentMethods),
    };
  }, [
    bdtPaymentMethods,
    brlPaymentMethods,
    eurPaymentMethods,
    mxnPaymentMethods,
    phpPaymentMethods,
  ]);

  const localCurrencies = useMemo(() => {
    const visibleCodes = showAllCurrencies
      ? [...FEATURED_LOCAL_CURRENCY_CODES, ...ADDITIONAL_LOCAL_CURRENCY_CODES]
      : FEATURED_LOCAL_CURRENCY_CODES;

    return visibleCodes
      .map(code => CARD_FUND_LOCAL_CURRENCIES.find(currency => currency.code === code))
      .filter((currency): currency is (typeof CARD_FUND_LOCAL_CURRENCIES)[number] => !!currency);
  }, [showAllCurrencies]);

  const handleUsdPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
      provider: virtualAccountProvider,
    });
    // A Wirex user has no Rain automation and never will, so the Rain apply
    // pitch is not their next step — their details screen owns activation for
    // both rails. The other entry points into this flow already route on the
    // provider; this one did not, which is how Wirex users reached a "Verify
    // now" that could only bounce them off the Rain KYC gate.
    if (virtualAccountProvider === 'wirex' || existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      return;
    }
    setIsVirtualAccountApplyOpen(true);
  };

  const handleLightningPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
      provider: 'orchestra',
      currency: 'USD',
    });
    // A previous order's invoice and read token would otherwise still be in the
    // store, and the status screen would track it instead of the new one.
    resetOrchestra();
    setModal(DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
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
          chips={USD_PAYMENT_METHOD_CHIPS}
          onPress={handleUsdPress}
        />
        {/* Always shown, never gated on the backend being reachable. A row that
            vanishes when something upstream is misconfigured is indistinguishable
            from a row that was never built — the amount screen says what is
            actually wrong instead. */}
        <CardFundRow
          className="min-h-[93px]"
          icon={
            <View
              className="items-center justify-center rounded-full bg-[#333333]"
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            >
              <Zap size={18} color="#94F27F" />
            </View>
          }
          title="Cash App"
          chips={LIGHTNING_PAYMENT_METHOD_CHIPS}
          onPress={handleLightningPress}
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

      <VirtualAccountApplyDialog
        isOpen={isVirtualAccountApplyOpen}
        onClose={() => setIsVirtualAccountApplyOpen(false)}
      />
    </>
  );
};

export default DepositCashOptions;
