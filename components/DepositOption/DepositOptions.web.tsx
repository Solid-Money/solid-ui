import { useDimension } from '@/hooks/useDimension';

import DepositOptionsDesktop from './DepositOptionsDesktop';
import DepositOptionsMobile from './DepositOptionsMobile';

/**
 * Web entry for the deposit options list. The "Send from your crypto wallet"
 * (thirdweb) path is desktop-only, so web-mobile (<768) uses the QR /
 * deposit-address-only variant — which keeps thirdweb hooks
 * (useDepositExternalWalletOptions) off the web-mobile render path now that the
 * ThirdwebProvider is desktop-only.
 */
const DepositOptions = () => {
  const { isDesktop } = useDimension();
  return isDesktop ? <DepositOptionsDesktop /> : <DepositOptionsMobile />;
};

export default DepositOptions;
