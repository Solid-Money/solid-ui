import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { WalletTokenList } from '@/components/WalletTokenSelector';
import { useTierMembership, useTierUpgradeChainState } from '@/hooks/useTierMembership';
import { useCashPayment } from '@/hooks/useTierUpgradeFunding';
import { findOffer } from '@/lib/tierUpgrade';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

/**
 * Which token pays the annual fee.
 *
 * The same token list withdraw, deposit and the lock picker use, with the
 * chain under each ticker, because here the chain is the point: USDC on Fuse
 * pays as it is, and USDC on Base — or ETH on Ethereum — is moved to Fuse
 * first. Balances are what the user holds; the ones too small to pay
 * anything are left off rather than offered and refused.
 */
const CashTokenSelector = () => {
  const { data: membership } = useTierMembership();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const tier = useTierUpgradeStore(state => state.tier);
  const setCashToken = useTierUpgradeStore(state => state.setCashToken);
  const offer = tier ? findOffer(membership, tier) : undefined;
  const { tokens, token } = useCashPayment({
    membership,
    chain,
    feeUsd: offer?.annualFeeUsd ?? 0,
  });

  return (
    <View className="mx-auto w-full max-w-[414px] gap-4">
      <Text className="text-base font-medium opacity-70">
        Pick what to pay with. Anything outside Fuse is moved to USDC on Fuse for you, and the
        bridge fees are on us.
      </Text>

      <WalletTokenList
        tokens={tokens}
        selectedToken={token ?? null}
        onSelect={row => setCashToken({ chainId: row.chainId, address: row.contractAddress })}
      />
    </View>
  );
};

export default CashTokenSelector;
