import { View } from 'react-native';
import { Building2, Zap } from 'lucide-react-native';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useVirtualAccountEntry } from '@/hooks/useVirtualAccountEntry';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useOrchestraStore } from '@/store/useOrchestraStore';

import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 36;

const BANK_CHIPS = ['Wire', 'ACH'];
const CASH_APP_CHIPS = ['Lightning', 'Instant'];

/**
 * How to fund in USD: the bank rail, or Cash App over Lightning.
 *
 * Only reached when Cash App is available — outside the US the cash list sends
 * USD straight to the virtual account, because a chooser with one option is a
 * tap that asks a question with one answer.
 */
const DepositUsdOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const resetOrchestra = useOrchestraStore(state => state.reset);
  const { open: openVirtualAccount, isApplyOpen, closeApply } = useVirtualAccountEntry();

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

  return (
    <>
      <CardFundGroup>
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
          onPress={openVirtualAccount}
          chips={BANK_CHIPS}
        />
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
          subtitle="Pay a Lightning invoice"
          onPress={handleCashAppPress}
          chips={CASH_APP_CHIPS}
        />
      </CardFundGroup>

      <VirtualAccountApplyDialog isOpen={isApplyOpen} onClose={closeApply} />
    </>
  );
};

export default DepositUsdOptions;
