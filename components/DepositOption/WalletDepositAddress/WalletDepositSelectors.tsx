import { useMemo, useState } from 'react';
import { ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
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

type Option = {
  key: string;
  label: string;
  icon: ImageSourcePropType;
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
    <ChevronDown
      size={16}
      color="rgba(255,255,255,0.6)"
      style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
    />
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
}) => (
  <View
    className="overflow-hidden rounded-[15px] bg-card web:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
    style={styles.overlay}
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
  </View>
);

type WalletDepositSelectorsProps = {
  chainId: number;
  symbol: string;
  onChainChange: (chainId: number) => void;
  onSymbolChange: (symbol: string) => void;
};

/**
 * The chain and currency pills above the QR, with their option lists expanding
 * inline underneath.
 *
 * The list is positioned over the content rather than expanding in flow: pushing
 * the QR and the copy below it down the screen every time the picker opens makes
 * the whole screen jump, and the QR is the thing the user is looking at.
 *
 * It is drawn in this component rather than in a popover or bottom sheet because
 * the screen is already inside the deposit modal, and a second overlay on top of
 * one is the arrangement that behaves differently on each platform.
 */
const WalletDepositSelectors = ({
  chainId,
  symbol,
  onChainChange,
  onSymbolChange,
}: WalletDepositSelectorsProps) => {
  const [openPicker, setOpenPicker] = useState<'chain' | 'token' | null>(null);

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

  const selectedChain = chainOptions.find(option => option.key === String(chainId));
  const selectedToken = tokenOptions.find(option => option.key === symbol);

  const toggle = (picker: 'chain' | 'token') =>
    setOpenPicker(current => (current === picker ? null : picker));

  return (
    // zIndex lifts the open list over the QR card, which is a later sibling and
    // would otherwise paint on top of it.
    <View style={{ zIndex: 20 }}>
      <View className="flex-row items-center justify-center gap-x-2">
        <Pill
          option={selectedChain}
          isOpen={openPicker === 'chain'}
          onPress={() => toggle('chain')}
          accessibilityLabel="Choose network"
        />
        <Pill
          option={selectedToken}
          isOpen={openPicker === 'token'}
          onPress={() => toggle('token')}
          accessibilityLabel="Choose currency"
        />
      </View>

      {openPicker ? (
        // Tapping the content the list now covers dismisses it, the way tapping
        // outside a popover would.
        <Pressable
          accessibilityLabel="Close the list"
          style={[styles.overlay, styles.backdrop]}
          onPress={() => setOpenPicker(null)}
        />
      ) : null}

      {openPicker === 'chain' ? (
        <OptionList
          options={chainOptions}
          selectedKey={String(chainId)}
          onSelect={key => {
            onChainChange(Number(key));
            setOpenPicker(null);
          }}
        />
      ) : null}

      {openPicker === 'token' ? (
        <OptionList
          options={tokenOptions}
          selectedKey={symbol}
          onSelect={key => {
            onSymbolChange(key);
            setOpenPicker(null);
          }}
        />
      ) : null}
    </View>
  );
};

export default WalletDepositSelectors;
