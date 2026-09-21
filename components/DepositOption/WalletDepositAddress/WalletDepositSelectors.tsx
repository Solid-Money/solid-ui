import { useEffect, useMemo } from 'react';
import { ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Check, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import {
  getWalletDepositNetworks,
  getWalletDepositTokens,
  type WalletDepositNetwork,
  type WalletDepositToken,
} from './constants';

const PILL_ICON_STYLE = { width: 20, height: 20, borderRadius: 10 };
const ROW_ICON_STYLE = { width: 28, height: 28, borderRadius: 14 };
/** `h-[35px]` on the pill plus the gap the list sits below the row. */
const LIST_TOP = 35 + 12;
/** Tall enough to cover the QR card the open list floats over. */
const BACKDROP_HEIGHT = 900;
const OPEN_DURATION_MS = 180;
const CLOSE_DURATION_MS = 140;

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

/** How far the list slides down into place. */
const LIST_TRAVEL = 8;

/** Which pill's list is open, if either. */
export type WalletDepositPickerKind = 'chain' | 'token' | null;

type Option = {
  key: string;
  label: string;
  icon: ImageSourcePropType;
};

const useOptions = (chainId: number) => {
  const chainOptions: Option[] = useMemo(
    () =>
      getWalletDepositNetworks().map((network: WalletDepositNetwork) => ({
        key: String(network.chainId),
        label: network.name,
        icon: network.icon,
      })),
    [],
  );
  const tokenOptions: Option[] = useMemo(
    () =>
      getWalletDepositTokens(chainId).map((token: WalletDepositToken) => ({
        key: token.symbol,
        label: token.symbol,
        icon: token.icon,
      })),
    [chainId],
  );

  return { chainOptions, tokenOptions };
};

/** The pill's chevron, turning over as its list opens and closes. */
const Chevron = ({ isOpen }: { isOpen: boolean }) => {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const rotate = `${isOpen ? 180 : 0}deg`;
    return {
      transform: [
        {
          rotate: reduceMotion
            ? rotate
            : withTiming(rotate, {
                duration: isOpen ? OPEN_DURATION_MS : CLOSE_DURATION_MS,
              }),
        },
      ],
    };
  }, [isOpen, reduceMotion]);

  return (
    <Animated.View style={style}>
      <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
    </Animated.View>
  );
};

const Pill = ({
  option,
  isOpen,
  onPress,
  accessibilityLabel,
}: {
  option?: Option;
  isOpen: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ expanded: isOpen }}
    onPress={onPress}
    className="h-[35px] flex-row items-center gap-x-2 rounded-full bg-card px-3 web:transition-colors web:hover:bg-card-hover"
  >
    {option ? (
      <Image source={option.icon} style={PILL_ICON_STYLE} contentFit="cover" />
    ) : (
      <View style={PILL_ICON_STYLE} />
    )}
    <Text className="text-base font-semibold leading-none text-white">{option?.label ?? '—'}</Text>
    <Chevron isOpen={isOpen} />
  </Pressable>
);

const OptionList = ({
  options,
  selectedKey,
  onSelect,
}: {
  options: Option[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: OPEN_DURATION_MS });
  }, [progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * LIST_TRAVEL }],
  }));

  return (
    <Animated.View
      className="overflow-hidden rounded-[15px] bg-card web:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      style={[styles.overlay, style]}
    >
      {options.map((option, index) => (
        <Pressable
          key={option.key}
          onPress={() => onSelect(option.key)}
          className={cn(
            'flex-row items-center gap-x-3 px-[18px] py-3 web:transition-colors web:hover:bg-card-hover',
            index > 0 && 'border-t border-white/[0.06]',
          )}
        >
          <Image source={option.icon} style={ROW_ICON_STYLE} contentFit="cover" />
          <Text className="flex-1 text-base font-semibold text-white">{option.label}</Text>
          {option.key === selectedKey ? <Check size={18} color="#94F27F" /> : null}
        </Pressable>
      ))}
    </Animated.View>
  );
};

type WalletDepositSelectorsProps = {
  chainId: number;
  symbol: string;
  openPicker: WalletDepositPickerKind;
  onToggle: (picker: Exclude<WalletDepositPickerKind, null>) => void;
};

/**
 * The chain and currency pills above the QR.
 *
 * The lists they open are `WalletDepositPicker`, deliberately a separate
 * component: it has to be the screen's last child to paint over the QR card, and
 * a `zIndex` on this one is not enough to lift a child of an earlier sibling
 * above a later one — which is exactly how the list ended up behind the QR.
 */
const WalletDepositSelectors = ({
  chainId,
  symbol,
  openPicker,
  onToggle,
}: WalletDepositSelectorsProps) => {
  const { chainOptions, tokenOptions } = useOptions(chainId);

  const selectedChain = chainOptions.find(option => option.key === String(chainId));
  const selectedToken = tokenOptions.find(option => option.key === symbol);

  return (
    <View className="flex-row items-center justify-center gap-x-2">
      <Pill
        option={selectedChain}
        isOpen={openPicker === 'chain'}
        onPress={() => onToggle('chain')}
        accessibilityLabel="Choose network"
      />
      <Pill
        option={selectedToken}
        isOpen={openPicker === 'token'}
        onPress={() => onToggle('token')}
        accessibilityLabel="Choose currency"
      />
    </View>
  );
};

type WalletDepositPickerProps = {
  chainId: number;
  symbol: string;
  openPicker: WalletDepositPickerKind;
  onChainChange: (chainId: number) => void;
  onSymbolChange: (symbol: string) => void;
  onDismiss: () => void;
};

/**
 * The open pill's list, floating over the content below it.
 *
 * Two things keep it in front, and both were learnt the hard way:
 *
 * 1. It is rendered as the screen's last child, so paint order alone puts it on
 *    top. `zIndex` does not: React Native honours it between siblings, not
 *    between a nested child and a later sibling, and Android differs again.
 * 2. It animates from a shared value rather than with Reanimated's `entering` /
 *    `exiting` layout animations. Those re-parent the view as they run, which
 *    dropped the list behind the QR card even once the order was right.
 *
 * `LIST_TOP` measures from the top of that root, which is where the pill row
 * starts, so the list lands just under the pills.
 */
export const WalletDepositPicker = ({
  chainId,
  symbol,
  openPicker,
  onChainChange,
  onSymbolChange,
  onDismiss,
}: WalletDepositPickerProps) => {
  const { chainOptions, tokenOptions } = useOptions(chainId);

  if (!openPicker) return null;

  return (
    <>
      {/* Tapping the content the list covers dismisses it, as tapping outside a
          popover would. */}
      <Pressable
        accessibilityLabel="Close the list"
        style={[styles.overlay, styles.backdrop]}
        onPress={onDismiss}
      />

      {openPicker === 'chain' ? (
        <OptionList
          options={chainOptions}
          selectedKey={String(chainId)}
          onSelect={key => {
            onChainChange(Number(key));
            onDismiss();
          }}
        />
      ) : (
        <OptionList
          options={tokenOptions}
          selectedKey={symbol}
          onSelect={key => {
            onSymbolChange(key);
            onDismiss();
          }}
        />
      )}
    </>
  );
};

export default WalletDepositSelectors;
