import { View } from 'react-native';
import { fuse } from 'viem/chains';

import { Text } from '@/components/ui/text';
import { WalletTokenList } from '@/components/WalletTokenSelector';
import { useNativePriceUsd } from '@/hooks/useNativePriceUsd';
import { useTierMembership, useTierUpgradeChainState } from '@/hooks/useTierMembership';
import { lockAssetFromRow, lockTokenRows } from '@/lib/lockTokenRows';
import { type LockPaymentBalances } from '@/lib/tierLockPayment';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

/**
 * Which token pays for the lock.
 *
 * The app's own token list, the one withdraw and deposit use, so a row here
 * behaves like a row anywhere else: same icon, same balance on the right, same
 * green outline on the one in force.
 *
 * Deliberately not built from the wallet's balances, which is the one thing
 * that list is normally handed. This picker offers exactly what the lock can be
 * paid with, and a list filtered by what the user holds would hide the two they
 * do not hold yet — which are the ones they are most likely to be about to top
 * up, and the reason they opened the picker.
 */
const LockTokenSelector = () => {
  const { data: membership } = useTierMembership();
  const { data: chain } = useTierUpgradeChainState(membership?.contracts);
  const selected = useTierUpgradeStore(state => state.lockAsset);
  const setLockAsset = useTierUpgradeStore(state => state.setLockAsset);
  // Shares its cache key with the savings screens, so this costs a read rather
  // than a request on any session that has looked at Savings.
  const fusePriceUsd = useNativePriceUsd(fuse.id, 'fusePriceUsd', true);

  const balances: LockPaymentBalances = {
    sofuse: chain?.fuse ?? 0,
    native: chain?.nativeFuse ?? 0,
    wrapped: chain?.wrappedFuse ?? 0,
  };

  // Three rows off a balance poll: not worth memoising, and a stale array here
  // would be a picker showing a balance the step behind it has already updated.
  const tokens = lockTokenRows({
    balances,
    zapAvailable: Boolean(membership?.contracts.lockZapAddress),
    chainId: membership?.contracts.chainId ?? fuse.id,
    addresses: {
      wrappedNativeAddress: membership?.contracts.wrappedNativeAddress,
      shareTokenAddress: membership?.contracts.shareTokenAddress,
    },
    fusePriceUsd,
  });

  const selectedToken = tokens.find(token => token.contractTickerSymbol === selected) ?? null;

  return (
    <View className="mx-auto w-full max-w-[414px] gap-4">
      {/* Says the unit once, so the three rows below do not each have to. All
          of them are quoted in FUSE, including soFUSE, which is shown at what
          the vault would return for it. */}
      <Text className="text-base font-medium opacity-70">
        Pick what to lock. Balances are shown in FUSE.
      </Text>

      <WalletTokenList
        tokens={tokens}
        selectedToken={selectedToken}
        onSelect={token => {
          const asset = lockAssetFromRow(token);
          if (asset) setLockAsset(asset);
        }}
      />
    </View>
  );
};

export default LockTokenSelector;
