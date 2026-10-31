import React from 'react';
import { View } from 'react-native';

import { DetailCard, DetailRowSpec } from '@/components/Send/CrossChain/shared';
import { Text } from '@/components/ui/text';
import { SwapFlowModel } from '@/hooks/swap/useSwapFlow';
import { assetDisplayName } from '@/lib/swapAssets';
import { formatSwapAmount, formatSwapUsd } from '@/lib/utils/swap/format';

/** "Instantly" in the same transaction, else whole minutes: "About 2 min". */
export const formatArrival = (etaSeconds: number | undefined): string => {
  if (etaSeconds === undefined) return '—';
  if (etaSeconds <= 0) return 'Instantly';
  return `About ${Math.max(1, Math.round(etaSeconds / 60))} min`;
};

/** "$0.10 (0.5%)", "Free", or "—" when the route left a fee unpriced. */
export const formatFee = (
  usd: number | null | undefined,
  percentage: number | null | undefined,
) => {
  if (usd === undefined) return '—';
  if (usd === 0) return 'Free';
  if (usd === null) return '—';
  const share =
    percentage !== null && percentage !== undefined && percentage > 0
      ? ` (${Number((percentage * 100).toFixed(2))}%)`
      : '';
  return `${formatSwapUsd(usd)}${share}`;
};

export function swapDetailRows(model: SwapFlowModel): DetailRowSpec[] {
  const from = model.fromAsset ? assetDisplayName(model.fromAsset) : '';
  const to = model.toAsset ? assetDisplayName(model.toAsset) : '';
  return [
    {
      key: 'rate',
      label: 'Rate',
      value: model.rate !== undefined ? `1 ${from} = ${formatSwapAmount(model.rate)} ${to}` : '—',
    },
    { key: 'fee', label: 'Fee', value: formatFee(model.feeUsd, model.feePercentage) },
    {
      key: 'network',
      label: 'Network fee',
      // Gas is sponsored on every network the swap runs on.
      value: <Text className="text-base font-medium text-brand">Paid by Solid</Text>,
    },
    { key: 'arrives', label: 'Arrives', value: formatArrival(model.etaSeconds) },
  ];
}

/** Rate, fee, network fee and arrival, and any notice, under the form. */
const SwapDetailsCard = ({
  model,
  showFootnote = true,
}: {
  model: SwapFlowModel;
  showFootnote?: boolean;
}) => (
  <View className="gap-2">
    <DetailCard rows={swapDetailRows(model)} />
    {showFootnote && model.feeFootnote ? (
      <Text className="px-1 text-xs text-white/50">{model.feeFootnote}</Text>
    ) : null}
    {model.notice ? <Text className="px-1 text-sm text-white/60">{model.notice}</Text> : null}
  </View>
);

export default SwapDetailsCard;
