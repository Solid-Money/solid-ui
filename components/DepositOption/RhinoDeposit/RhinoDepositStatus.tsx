import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import DepositScanningIndicator from '@/components/Card/CardFund/DepositScanningIndicator';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { useRhinoDeposits } from '@/hooks/useRhinoDeposits';
import { getRhinoDepositStatusView } from '@/lib/rhinoDeposit';

import type { RhinoDepositAssetsResponse, RhinoDestinationType } from '@/lib/types';

type RhinoDepositStatusProps = {
  /** Watch only while the address is on screen. */
  enabled: boolean;
  depositAddress?: string;
  /** rhino.fi chain id the address was shown for, e.g. `TRON`. */
  chain: string;
  /** That chain's name as the screen shows it. */
  chainName: string;
  addressType?: string;
  /** The destination the address is for: only its deposits show. */
  destinationType: RhinoDestinationType;
};

/**
 * The name of the chain a deposit came in on. It is the screen's own when the
 * deposit came in on the chain the screen was opened for; an EVM address takes
 * every EVM chain, so it can be another, named as the app names its row
 * ("Polygon"), else as rhino.fi does.
 */
const depositChainName = (
  depositChain: string,
  { chain, chainName }: { chain: string; chainName: string },
  assets: RhinoDepositAssetsResponse | undefined,
): string => {
  if (depositChain === chain) return chainName;
  const rhinoChain = assets?.chains.find(item => item.chain === depositChain);
  const appName =
    rhinoChain?.chainId !== undefined ? getBridgeChain(rhinoChain.chainId)?.name : undefined;
  return appName ?? rhinoChain?.name ?? depositChain;
};

const Chip = ({ label, trailing }: { label: string; trailing: React.ReactNode }) => (
  <View className="flex-row items-center gap-x-2 self-center rounded-[18px] bg-[#333333] px-4 py-2">
    <Text className="text-sm leading-4 text-white">{label}</Text>
    {trailing}
  </View>
);

/**
 * rhino.fi's side of a deposit to its address: scanning until a transfer shows
 * up, then received / on its way, or why it was rejected or returned. Polls
 * `/deposit/rhino/deposits` from the moment the address is shown. Any token
 * sent to the address, on any chain it takes, counts, and is named as it came
 * in.
 */
const RhinoDepositStatus = ({
  enabled,
  depositAddress,
  chain,
  chainName,
  addressType,
  destinationType,
}: RhinoDepositStatusProps) => {
  const { deposit } = useRhinoDeposits({
    enabled,
    depositAddress,
    addressType,
    destinationType,
  });
  const { assets } = useOfferedRhinoDepositAssets();

  if (!enabled || !depositAddress) return null;

  if (!deposit) {
    return <Chip label="Scanning for deposits" trailing={<DepositScanningIndicator />} />;
  }

  const view = getRhinoDepositStatusView(
    deposit,
    depositChainName(deposit.chain, { chain, chainName }, assets),
  );

  if (view.tone === 'error' || view.tone === 'neutral') {
    const isError = view.tone === 'error';
    return (
      <View
        className={
          isError
            ? 'w-full gap-y-1 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3'
            : 'w-full gap-y-1 rounded-2xl bg-card px-4 py-3'
        }
      >
        <Text className={`text-center font-medium ${isError ? 'text-red-400' : 'text-white'}`}>
          {view.title}
        </Text>
        {view.body ? <Text className="text-center text-sm text-white/70">{view.body}</Text> : null}
      </View>
    );
  }

  return (
    <View className="items-center gap-y-1.5">
      <Chip
        label={view.title}
        trailing={
          view.tone === 'success' ? (
            <Check size={16} color="#94F27F" />
          ) : (
            <DepositScanningIndicator />
          )
        }
      />
      {view.body ? <Text className="text-center text-sm text-white/70">{view.body}</Text> : null}
    </View>
  );
};

export default RhinoDepositStatus;
