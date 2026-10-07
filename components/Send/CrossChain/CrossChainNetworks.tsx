import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { arbitrum, fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { track } from '@/lib/analytics';
import { CrossChainSendNetworkConfig } from '@/lib/types/cross-chain-send';
import { cn } from '@/lib/utils';
import { describeReceivesAs, formatLD, getCrossChainSendToken } from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import { Chip, NetworkIcon } from './shared';

type RowSpec = {
  network: CrossChainSendNetworkConfig;
  subtitle: string;
  chips: React.ReactNode;
  disabled: boolean;
  dimmed: boolean;
};

/** The route shown first and marked "Recommended": the cheapest, fastest one exchanges widely accept. */
const RECOMMENDED_CHAIN_ID = arbitrum.id;

/**
 * The network step of the cross-chain send: every network this token can be
 * received on, then everything else greyed out with the reason — so a user who
 * expected Polygon, or USDT on Base, learns why it isn't offered.
 */
const CrossChainNetworks: React.FC = () => {
  const { selectedToken, setDestinationChainId, setModal } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      setDestinationChainId: state.setDestinationChainId,
      setModal: state.setModal,
    })),
  );
  const { config, getRoute } = useCrossChainSendConfig();
  const token = getCrossChainSendToken(selectedToken) ?? 'USDC';

  const { accepted, unavailable } = useMemo(() => {
    const acceptedRows: RowSpec[] = [];
    const unavailableRows: RowSpec[] = [];
    if (!config) return { accepted: acceptedRows, unavailable: unavailableRows };

    const perSendMax = BigInt(config.limits.perSendMax);
    // Recommended first, then config order.
    const networks = [...config.networks].sort(
      (a, b) =>
        Number(b.chainId === RECOMMENDED_CHAIN_ID) - Number(a.chainId === RECOMMENDED_CHAIN_ID),
    );

    for (const network of networks) {
      if (network.status === 'coming_soon') {
        unavailableRows.push({
          network,
          subtitle: 'Coming soon',
          chips: null,
          disabled: true,
          dimmed: true,
        });
        continue;
      }

      // Same chain: a plain send, no bridge.
      if (network.chainId === fuse.id) {
        acceptedRows.push({
          network,
          subtitle: 'Instant · no bridge',
          chips: null,
          disabled: false,
          dimmed: false,
        });
        continue;
      }

      if (!network.tokens.includes(token)) {
        unavailableRows.push({
          network,
          subtitle: `${token} can’t be received on ${network.name}. Send USDC instead`,
          chips: null,
          disabled: true,
          dimmed: true,
        });
        continue;
      }

      const route = getRoute(token, network.chainId);
      const chips = (
        <>
          {network.chainId === RECOMMENDED_CHAIN_ID ? (
            <Chip label="Recommended" tone="brand" />
          ) : null}
          <Chip label={`~${network.etaMinutes} min`} />
        </>
      );

      if (route && !route.available) {
        acceptedRows.push({
          network,
          subtitle: 'Temporarily unavailable',
          chips,
          disabled: true,
          dimmed: true,
        });
        continue;
      }

      let rowSubtitle = describeReceivesAs(network.receivesAs[token], token);
      if (route && BigInt(route.maxAmountLD) < perSendMax) {
        rowSubtitle = `Up to ${formatLD(route.maxAmountLD)} ${token} right now`;
      }

      acceptedRows.push({
        network,
        subtitle: rowSubtitle,
        chips,
        disabled: false,
        dimmed: false,
      });
    }

    // Fuse last among the available rows: the bridged networks are why the user is here.
    acceptedRows.sort(
      (a, b) => Number(a.network.chainId === fuse.id) - Number(b.network.chainId === fuse.id),
    );
    return { accepted: acceptedRows, unavailable: unavailableRows };
  }, [config, token, getRoute]);

  const handleSelect = useCallback(
    (network: CrossChainSendNetworkConfig) => {
      setDestinationChainId(network.chainId);
      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_NETWORK_SELECTED, {
        token,
        dst_chain_id: network.chainId,
        network: network.key,
      });
      setModal(SEND_MODAL.OPEN_CROSS_CHAIN_FORM);
    },
    [setDestinationChainId, setModal, token],
  );

  const renderRow = (row: RowSpec) => (
    <NetworkRow key={row.network.chainId} row={row} onPress={() => handleSelect(row.network)} />
  );

  return (
    <View className="gap-5">
      <Text className="text-center text-sm leading-[18px] text-white/70">
        Networks you can receive {token} on
      </Text>

      {accepted.length > 0 ? (
        <CardFundGroup>{accepted.map(renderRow)}</CardFundGroup>
      ) : config ? (
        <View className="rounded-[15px] bg-card px-[18px] py-5">
          <Text className="text-base font-semibold text-white">No networks available</Text>
          <Text className="text-sm leading-[18px] text-white/70">
            {token} can’t be sent to another network right now.
          </Text>
        </View>
      ) : null}

      {unavailable.length > 0 ? (
        <View className="gap-3">
          <Text className="text-base font-semibold text-white">Not available</Text>
          <CardFundGroup>{unavailable.map(renderRow)}</CardFundGroup>
        </View>
      ) : null}
    </View>
  );
};

type NetworkRowProps = {
  row: RowSpec;
  onPress: () => void;
};

/** One network line: icon, name with its chips beside it, the reason under it. */
const NetworkRow = ({ row, onPress }: NetworkRowProps) => (
  <Pressable
    className={cn(
      'flex-row items-center gap-x-3.5 px-[18px] py-4 web:transition-colors',
      row.dimmed ? 'opacity-40' : 'web:hover:bg-card-hover',
    )}
    onPress={onPress}
    disabled={row.disabled}
  >
    <NetworkIcon networkKey={row.network.key} />
    <View className="flex-1 gap-y-1">
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-lg font-semibold leading-tight text-white">{row.network.name}</Text>
        {row.chips}
      </View>
      <Text className="text-sm leading-[18px] text-white/70">{row.subtitle}</Text>
    </View>
    <ChevronRight color="white" size={20} />
  </Pressable>
);

export default CrossChainNetworks;
