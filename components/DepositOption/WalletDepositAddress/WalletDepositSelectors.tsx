import { useMemo } from 'react';
import { ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { cn } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import {
  getWalletDepositNetworks,
  getWalletDepositNetworksForToken,
  getWalletDepositTokenIcon,
} from './constants';

const PILL_ICON_STYLE = { width: 20, height: 20, borderRadius: 10 };
const ROW_ICON_STYLE = { width: 28, height: 28, borderRadius: 14 };
/** `h-[35px]` on the pill plus the gap the list sits below the row. */
const LIST_TOP = 35 + 12;
/** Tall enough to cover the QR card the open list floats over. */
const BACKDROP_HEIGHT = 900;

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
});

const Pill = ({
  icon,
  label,
  isOpen,
  onPress,
  accessibilityLabel,
}: {
  icon?: ImageSourcePropType;
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
    {icon ? (
      <Image source={icon} style={PILL_ICON_STYLE} contentFit="cover" />
    ) : (
      <View style={PILL_ICON_STYLE} />
    )}
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
        icon={getWalletDepositTokenIcon(chainId, symbol)}
        label={symbol}
        onPress={() => {
          setWalletDeposit({ isChangingToken: true });
          setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN);
        }}
        accessibilityLabel="Choose currency"
      />
      <Pill
        icon={network?.icon}
        label={network?.name ?? '—'}
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
  onSelect: (chainId: number) => void;
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
 * can never quietly change the currency with it.
 */
export const WalletDepositNetworkList = ({
  chainId,
  symbol,
  onSelect,
  onDismiss,
}: WalletDepositNetworkListProps) => {
  const networks = useMemo(() => getWalletDepositNetworksForToken(symbol), [symbol]);

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
            {item.chainId === chainId ? <Check size={18} color="#94F27F" /> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
};

export default WalletDepositSelectors;
