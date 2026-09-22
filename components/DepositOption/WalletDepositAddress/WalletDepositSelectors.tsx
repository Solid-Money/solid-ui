import { useMemo } from 'react';
import { ImageSourcePropType, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';

import { getWalletDepositNetworks, getWalletDepositTokenIcon } from './constants';

const PILL_ICON_STYLE = { width: 20, height: 20, borderRadius: 10 };

const Pill = ({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon?: ImageSourcePropType;
  label: string;
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
    <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
  </Pressable>
);

type WalletDepositSelectorsProps = {
  chainId: number;
  symbol: string;
};

/**
 * The chain and currency buttons above the QR.
 *
 * They open their own steps rather than dropping a list down over the screen.
 * A dropdown here had to float over a QR filling most of the card, which made it
 * the one element whose stacking and background had to be fought for on every
 * platform; and the chain already had a step of its own, reached on the way in.
 * Both now behave identically, and this screen holds no overlay state at all.
 */
const WalletDepositSelectors = ({ chainId, symbol }: WalletDepositSelectorsProps) => {
  const setModal = useDepositStore(state => state.setModal);

  const network = useMemo(
    () => getWalletDepositNetworks().find(item => item.chainId === chainId),
    [chainId],
  );

  return (
    <View className="flex-row items-center justify-center gap-x-2">
      <Pill
        icon={network?.icon}
        label={network?.name ?? '—'}
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_CHAIN)}
        accessibilityLabel="Choose network"
      />
      <Pill
        icon={getWalletDepositTokenIcon(chainId, symbol)}
        label={symbol}
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN)}
        accessibilityLabel="Choose currency"
      />
    </View>
  );
};

export default WalletDepositSelectors;
