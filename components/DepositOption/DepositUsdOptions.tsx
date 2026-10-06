import { useEffect } from 'react';
import { View } from 'react-native';
import { Building2, Zap } from 'lucide-react-native';

import ApplePayCircle from '@/assets/images/apple-pay-circle';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useIsCashAppAvailable } from '@/hooks/useOrchestra';
import { useVirtualAccountEntry } from '@/hooks/useVirtualAccountEntry';
import { track } from '@/lib/analytics';
import { isDevFeatureEnabled } from '@/lib/config';
import { canFundByUsdBankTransfer } from '@/lib/utils/cardHelpers';
import { useDepositStore } from '@/store/useDepositStore';
import { useOrchestraStore } from '@/store/useOrchestraStore';

import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 36;

const BANK_CHIPS = ['Wire', 'ACH'];
// The row is already titled Cash App; the chip says how fast, not how.
const CASH_APP_CHIPS = ['Instant'];

type UsdMethodListProps = {
  /** Omit to hide the row — a Wirex cardholder has no bank rail to their card. */
  onBankTransferPress?: () => void;
  /** Omit to hide the row — Cash App is only offered where the server allows it. */
  onCashAppPress?: () => void;
  /** Its row shows only on qa/preview builds — see {@link isApplePayEnabled}. */
  onApplePayPress: () => void;
};

/**
 * Apple Pay (Onramper's widget) is still being tested, so it is offered on
 * qa/preview builds and hidden in production. A function rather than a
 * constant so tests can flip the flag. Remove it at launch.
 */
export const isApplePayEnabled = () => isDevFeatureEnabled;

/**
 * The USD methods as rows. Shared by this screen and the card funding modals'
 * USD step, so the two lists cannot drift apart; each caller decides what a
 * press does, because each owns a different navigator.
 */
export const UsdMethodList = ({
  onBankTransferPress,
  onCashAppPress,
  onApplePayPress,
}: UsdMethodListProps) => (
  <CardFundGroup>
    {onBankTransferPress ? (
      <CardFundRow
        className="min-h-[93px]"
        icon={
          <View
            className="items-center justify-center rounded-full bg-[#333333]"
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
          >
            <Building2 size={18} color="#FFFFFF" />
          </View>
        }
        title="Wire transfer, ACH"
        subtitle="Your own US account details"
        onPress={onBankTransferPress}
        chips={BANK_CHIPS}
      />
    ) : null}
    {onCashAppPress ? (
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
        subtitle="Pay from your Cash App balance"
        onPress={onCashAppPress}
        chips={CASH_APP_CHIPS}
      />
    ) : null}
    {/* Onramper's hosted widget. Apple Pay is the name the row goes by, but the
        widget also takes cards, so the subtitle says so. */}
    {isApplePayEnabled() ? (
      <CardFundRow
        className="min-h-[93px]"
        icon={<ApplePayCircle width={ICON_SIZE} height={ICON_SIZE} />}
        title="Apple Pay"
        subtitle="Pay with Apple Pay or a card"
        onPress={onApplePayPress}
      />
    ) : null}
  </CardFundGroup>
);

/**
 * The chips for a USD row that opens {@link UsdMethodList}, naming the methods
 * it lists — Cash App only where it is offered, and ACH / Wire only where the
 * bank rail is, and Apple Pay only where it is enabled, since only there does
 * the list show them. An empty list means USD has no method. Shared by the
 * wallet's cash list and the card funding options, so the two USD rows cannot
 * drift apart.
 */
export const getUsdMethodChips = (isCashAppAvailable: boolean, hasBankTransfer = true) => [
  ...(hasBankTransfer ? ['ACH', 'Wire'] : []),
  ...(isCashAppAvailable ? ['Cash App'] : []),
  ...(isApplePayEnabled() ? ['Apple Pay'] : []),
];

/**
 * How to fund in USD: the bank rail, Apple Pay through Onramper's widget, or
 * Cash App over Lightning.
 *
 * Apple Pay is offered everywhere it is enabled (qa/preview builds only, for
 * now). The bank rail is too, except to a user whose virtual account is issued
 * by Wirex, which supports no wire (`canFundByUsdBankTransfer`). Cash App is
 * US-only, and its row appears only where the server says it is available.
 */
const DepositUsdOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const resetOrchestra = useOrchestraStore(state => state.reset);
  const {
    open: openVirtualAccount,
    isApplyOpen,
    closeApply,
    provider: virtualAccountProvider,
  } = useVirtualAccountEntry();
  const isCashAppAvailable = useIsCashAppAvailable();

  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_USD_METHOD_VIEWED);
  }, []);

  const handleCashAppPress = () => {
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

  const handleApplePayPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
      provider: 'onramper',
      currency: 'USD',
    });
    setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_WIDGET);
  };

  return (
    <>
      <UsdMethodList
        onBankTransferPress={
          canFundByUsdBankTransfer(virtualAccountProvider) ? openVirtualAccount : undefined
        }
        onCashAppPress={isCashAppAvailable ? handleCashAppPress : undefined}
        onApplePayPress={handleApplePayPress}
      />

      <VirtualAccountApplyDialog isOpen={isApplyOpen} onClose={closeApply} />
    </>
  );
};

export default DepositUsdOptions;
