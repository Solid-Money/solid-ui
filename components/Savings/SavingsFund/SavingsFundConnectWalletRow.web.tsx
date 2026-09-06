import React from 'react';

import FundExternalWallet from '@/assets/images/fund-external-wallet';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import useDepositExternalWalletOptions from '@/hooks/useDepositExternalWalletOptions';

/**
 * "Send from your crypto wallet" — the thirdweb connect row, shown inline on the
 * "Deposit to savings" screen instead of the "Deposit from an external wallet"
 * row that led to a sub-screen listing this as its only desktop option.
 *
 * Calls thirdweb hooks (via useDepositExternalWalletOptions), so it MUST only be
 * rendered on desktop web, where the ThirdwebProvider is mounted. Web-mobile and
 * native resolve `SavingsFundConnectWalletRow.native` instead.
 */
const SavingsFundConnectWalletRow = () => {
  const { externalWalletOptions } = useDepositExternalWalletOptions();
  const connectWallet = externalWalletOptions.find(option => option.method === 'wallet');

  if (!connectWallet) return null;

  return (
    <CardFundRow
      icon={<FundExternalWallet width={26} height={26} />}
      title={connectWallet.text}
      subtitle="Add supported assets from supported networks directly to your account"
      onPress={connectWallet.onPress}
      isLoading={connectWallet.isLoading}
    />
  );
};

export default SavingsFundConnectWalletRow;
