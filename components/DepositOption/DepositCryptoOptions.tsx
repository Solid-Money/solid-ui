import { View } from 'react-native';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import HomeQR from '@/assets/images/home-qr';
import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';

const CryptoIcon = ({ children }: { children: React.ReactNode }) => (
  <View className="h-[37px] w-[37px] items-center justify-center rounded-full bg-[#333333]">
    {children}
  </View>
);

/**
 * "Receive crypto" — the crypto branch of the deposit chooser: take the deposit
 * address and send from anywhere, or connect an external wallet and push the
 * transfer from here.
 */
const DepositCryptoOptions = () => {
  const { isDesktop } = useDimension();
  const setModal = useDepositStore(state => state.setModal);

  const handleShowAddressPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'deposit_directly' });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  const handleConnectWalletPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'wallet' });
    setModal(DEPOSIT_MODAL.OPEN_CONNECT_WALLET);
  };

  return (
    <CardFundGroup>
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
      {/* External-wallet connect is desktop-only (thirdweb's connect modal), so a
          phone is offered the address alone. */}
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
  );
};

export default DepositCryptoOptions;
