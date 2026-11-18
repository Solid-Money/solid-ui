import React from 'react';
import { View } from 'react-native';
import { Info } from 'lucide-react-native';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { describeRhinoArrival, formatRhinoUsdLimits, getRhinoChainNote } from '@/lib/rhinoDeposit';

import type { RhinoDestinationType } from '@/lib/types';

type RhinoDepositDetailsProps = {
  tokenSymbol: string;
  /** rhino.fi's chain id (`BITCOIN`), for anything to know about sending on it. */
  chain?: string;
  chainName: string;
  destinationType: RhinoDestinationType;
  /** What lands; omitted until the route is known. */
  receiveSymbol?: string;
  receiveChainId?: number;
  vault?: string;
  minimumUsd?: number;
  maximumUsd?: number;
};

/**
 * What to send to a rhino.fi address and what comes of it: the one token and
 * network it takes, the dollar band rhino.fi accepts, and what arrives where.
 *
 * No deposit fee line: a rhino.fi payout pays no Solid deposit fee.
 */
const RhinoDepositDetails = ({
  tokenSymbol,
  chain,
  chainName,
  destinationType,
  receiveSymbol,
  receiveChainId,
  vault,
  minimumUsd,
  maximumUsd,
}: RhinoDepositDetailsProps) => {
  const limits = formatRhinoUsdLimits(minimumUsd, maximumUsd);
  const chainNote = getRhinoChainNote(chain);

  return (
    <View className="gap-y-2">
      <View className="flex-row items-center justify-center gap-x-1.5 px-4">
        <Info size={16} color="#A1A1AA" />
        <Text className="min-w-0 shrink text-center text-base font-medium text-white">
          {`Send only ${tokenSymbol} on ${chainName}`}
        </Text>
        <TooltipPopover
          text="Sending any other token, or on any other network, may result in permanent loss of funds."
          analyticsContext="rhino_deposit_warning"
          side="top"
        />
      </View>
      {limits ? (
        <Text className="text-center text-sm text-white/70">{`${limits} per deposit`}</Text>
      ) : null}
      {receiveSymbol ? (
        <Text className="text-center text-sm text-white/70">
          {describeRhinoArrival({
            tokenSymbol,
            receiveSymbol,
            receiveChainId,
            destinationType,
            vault,
          })}
        </Text>
      ) : null}
      {chainNote ? <Text className="text-center text-sm text-white/70">{chainNote}</Text> : null}
      {limits ? (
        <Text className="text-center text-sm text-white/50">
          Deposits outside these limits can’t be processed
        </Text>
      ) : null}
    </View>
  );
};

export default RhinoDepositDetails;
