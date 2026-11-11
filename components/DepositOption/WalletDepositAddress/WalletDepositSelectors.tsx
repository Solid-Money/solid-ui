import { ReactNode, useMemo } from 'react';
import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronDown } from 'lucide-react-native';

import RhinoChainIcon from '@/components/DepositOption/RhinoDeposit/RhinoChainIcon';
import RhinoNetworksNotice from '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { cn } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import {
  getWalletDepositExtraNetworks,
  getWalletDepositNetworks,
  getWalletDepositNetworksForToken,
  getWalletDepositNetworksNotice,
  getWalletDepositTokenIcon,
} from './constants';
import { useWalletDepositViewer } from './useWalletDepositViewer';

const PILL_ICON_STYLE = { width: 20, height: 20, borderRadius: 10 };
const ROW_ICON_STYLE = { width: 28, height: 28, borderRadius: 14 };
/** `h-[35px]` on the pill plus the gap the list sits below the row. */
const LIST_TOP = 35 + 12;
/** Tall enough to cover the QR card the open list floats over. */
const BACKDROP_HEIGHT = 900;
/**
 * About eight rows. Only applied once rhino.fi's other chains lengthen the list: it
 * floats over the screen rather than in its flow, so rows past the end of the
 * content beneath could never be scrolled to.
 */
const LONG_LIST_MAX_HEIGHT = 420;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: LIST_TOP,
    left: 0,
    right: 0,
  },
  backdrop: {
    height: BACKDROP_HEIGHT,
  },
  longList: {
    maxHeight: LONG_LIST_MAX_HEIGHT,
  },
});

const Pill = ({
  icon,
  iconElement,
  label,
  isOpen,
  onPress,
  accessibilityLabel,
}: {
  icon?: ImageSourcePropType;
  /** Drawn in place of `icon`, for a chain with no logo to load. */
  iconElement?: ReactNode;
  label: string;
  isOpen?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={onPress}
    className="h-[35px] flex-row items-center gap-x-2 rounded-full bg-card px-3 web:transition-colors web:hover:bg-card-hover"
  >
    {iconElement ??
      (icon ? (
        <Image source={icon} style={PILL_ICON_STYLE} contentFit="cover" />
      ) : (
        <View style={PILL_ICON_STYLE} />
      ))}
    <Text className="text-base font-semibold leading-none text-white">{label}</Text>
    <ChevronDown
      size={16}
      color="rgba(255,255,255,0.6)"
      style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
    />
  </Pressable>
);

type WalletDepositSelectorsProps = {
  chainId: number;
  symbol: string;
  /** The "More networks" rhino.fi chain showing instead of `chainId`, when one is. */
  extraChain?: { chain: string; chainId?: number; name: string };
  isNetworkOpen: boolean;
  onToggleNetwork: () => void;
};

/**
 * The currency and network pills above the QR, in that order: the currency is
 * what was picked first and what the minimum is quoted in, so it leads.
 *
 * They open differently on purpose. The currency has its own step, which is also
 * the first step of the flow. The network drops a list down in place, because
 * changing it is an adjustment to the screen you are already on — sending that
 * one to a full screen made a small change feel like starting again.
 */
const WalletDepositSelectors = ({
  chainId,
  symbol,
  extraChain,
  isNetworkOpen,
  onToggleNetwork,
}: WalletDepositSelectorsProps) => {
  const setModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);

  const network = useMemo(
    () => getWalletDepositNetworks().find(item => item.chainId === chainId),
    [chainId],
  );

  return (
    <View className="flex-row items-center justify-center gap-x-2">
      <Pill
        icon={getWalletDepositTokenIcon(symbol)}
        label={symbol}
        onPress={() => {
          setWalletDeposit({ isChangingToken: true });
          setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN);
        }}
        accessibilityLabel="Choose currency"
      />
      <Pill
        icon={network?.icon}
        iconElement={
          extraChain ? (
            <RhinoChainIcon
              chain={extraChain.chain}
              chainId={extraChain.chainId}
              name={extraChain.name}
              size={PILL_ICON_STYLE.width}
            />
          ) : undefined
        }
        label={extraChain?.name ?? network?.name ?? '—'}
        isOpen={isNetworkOpen}
        onPress={onToggleNetwork}
        accessibilityLabel="Choose network"
      />
    </View>
  );
};

type WalletDepositNetworkListProps = {
  chainId: number;
  symbol: string;
  /** The rhino.fi chain the app has no row for selected instead of `chainId`, if any. */
  rhinoChain?: string;
  onSelect: (chainId: number) => void;
  /** A rhino.fi chain the app has no row for, by rhino.fi's id (`TRON`). */
  onSelectExtra: (chain: string) => void;
  onDismiss: () => void;
};

/**
 * The network list, floating under the pills over the content below.
 *
 * Plain views, and rendered as the screen's last child. Both matter: an
 * `Animated.View` does not resolve nativewind's `className`, so wrapping the
 * card would drop its background, and paint order is what puts it in front —
 * `zIndex` does not carry from a nested child over a later sibling.
 *
 * It offers only the chains carrying the chosen currency, so changing network
 * can never quietly change the currency with it, and of those only the rows
 * with an address: every row rhino.fi serves, plus Base and Fuse, which are our
 * own (see `getWalletDepositRow` in `constants`).
 * While rhino.fi's routes are out, or when they cannot be had, a loader or a
 * retry stands in for its rows.
 *
 * After them, in the same list: the chains the app has no row for that rhino.fi
 * takes the currency into the wallet from (Tron, Solana, Bitcoin, …).
 */
export const WalletDepositNetworkList = ({
  chainId,
  symbol,
  rhinoChain,
  onSelect,
  onSelectExtra,
  onDismiss,
}: WalletDepositNetworkListProps) => {
  const viewer = useWalletDepositViewer();
  const networks = useMemo(
    () => getWalletDepositNetworksForToken(symbol, viewer),
    [symbol, viewer],
  );
  const extraNetworks = useMemo(
    () => getWalletDepositExtraNetworks(symbol, viewer),
    [symbol, viewer],
  );
  const { retry: retryRhino } = useOfferedRhinoDepositAssets();
  const notice = getWalletDepositNetworksNotice(symbol, viewer);

  const rows = (
    <>
      {networks.map((item, index) => (
        <Pressable
          key={item.chainId}
          onPress={() => onSelect(item.chainId)}
          className={cn(
            'flex-row items-center gap-x-3 px-[18px] py-3 web:transition-colors web:hover:bg-card-hover',
            index > 0 && 'border-t border-white/[0.06]',
          )}
        >
          <Image source={item.icon} style={ROW_ICON_STYLE} contentFit="cover" />
          <Text className="flex-1 text-base font-semibold text-white">{item.name}</Text>
          {item.chainId === chainId && !rhinoChain ? <Check size={18} color="#94F27F" /> : null}
        </Pressable>
      ))}
      {extraNetworks.map((item, index) => (
        <Pressable
          key={item.chain}
          accessibilityLabel={item.name}
          onPress={() => onSelectExtra(item.chain)}
          className={cn(
            'flex-row items-center gap-x-3 px-[18px] py-3 web:transition-colors web:hover:bg-card-hover',
            (networks.length > 0 || index > 0) && 'border-t border-white/[0.06]',
          )}
        >
          <RhinoChainIcon
            chain={item.chain}
            chainId={item.chainId}
            name={item.name}
            size={ROW_ICON_STYLE.width}
          />
          <Text className="flex-1 text-base font-semibold text-white">{item.name}</Text>
          {item.chain === rhinoChain ? <Check size={18} color="#94F27F" /> : null}
        </Pressable>
      ))}
      {notice ? (
        <RhinoNetworksNotice
          notice={notice}
          symbol={symbol}
          hasRows={networks.length > 0}
          onRetry={retryRhino}
          className={cn(
            'py-4',
            (networks.length > 0 || extraNetworks.length > 0) && 'border-t border-white/[0.06]',
          )}
        />
      ) : null}
    </>
  );

  return (
    <>
      {/* Tapping what the list covers dismisses it, as tapping outside would. */}
      <Pressable
        accessibilityLabel="Close the list"
        style={[styles.overlay, styles.backdrop]}
        onPress={onDismiss}
      />

      <View
        className="overflow-hidden rounded-[15px] bg-card web:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        style={styles.overlay}
      >
        {extraNetworks.length ? (
          <ScrollView
            style={styles.longList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {rows}
          </ScrollView>
        ) : (
          rows
        )}
      </View>
    </>
  );
};

export default WalletDepositSelectors;
