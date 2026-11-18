import { useMemo } from 'react';
import { View } from 'react-native';

import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { Text } from '@/components/ui/text';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { getRhinoAssetsNotice } from '@/lib/rhinoDeposit';
import { useDepositStore } from '@/store/useDepositStore';

import { getWalletDepositCoin } from './constants';
import { useWalletDepositViewer } from './useWalletDepositViewer';
import { DepositTokenRow, useSelectWalletDepositToken } from './WalletDepositTokens';

/**
 * A coin's own screen, titled with its name ("Bitcoin"): which of its tokens is
 * being sent — BTC, WBTC or cbBTC — each of which has its own address and
 * networks. Reached from the coin's row in "Select token", and from the address
 * screen's currency pill while one of its tokens is showing, where the token
 * showing is ticked. Back goes to "Select token" either way, for another coin.
 *
 * Lists the tokens this person is offered, as "Select token" does, so it waits
 * for rhino.fi's routes in the same way when opened from the pill before they
 * are in.
 */
const WalletDepositCoinTokens = () => {
  const walletDeposit = useDepositStore(state => state.walletDeposit);
  const viewer = useWalletDepositViewer();
  const { retry: retryRhino } = useOfferedRhinoDepositAssets();
  const rhinoStatus = viewer.rhino?.status ?? 'loading';
  const rhinoNotice = getRhinoAssetsNotice(rhinoStatus);
  const coin = useMemo(
    () => getWalletDepositCoin(walletDeposit.coin, viewer),
    [walletDeposit.coin, viewer],
  );
  const tokens = coin?.tokens ?? [];
  const selectToken = useSelectWalletDepositToken(viewer);

  // As on "Select token": only marked when the user came back to change it.
  const selected = walletDeposit.isChangingToken ? walletDeposit.symbol : undefined;

  return (
    <View className="gap-y-5">
      {rhinoNotice ? (
        <RhinoNetworksNotice
          notice={rhinoNotice}
          symbol={coin?.name ?? ''}
          noun="tokens"
          hasRows={tokens.length > 0}
          onRetry={retryRhino}
          className={rhinoNotice === 'loading' ? 'py-14' : 'rounded-[15px] bg-card'}
        />
      ) : null}

      {rhinoStatus === 'loading' || !tokens.length ? null : (
        <View className="gap-y-2">
          <Text className="text-sm font-medium text-white/50">Pick the one you’re sending</Text>
          <View className="overflow-hidden rounded-[15px] bg-card">
            {tokens.map((token, index) => (
              <DepositTokenRow
                key={token.symbol}
                icon={token.icon}
                ticker={token.symbol}
                name={token.name}
                isSelected={token.symbol === selected}
                hasDivider={index < tokens.length - 1}
                onPress={() => selectToken(token.symbol)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default WalletDepositCoinTokens;
