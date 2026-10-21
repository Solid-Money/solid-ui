import { useMemo, useState } from 'react';
import { ImageSourcePropType, Keyboard, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronRight, Search, X } from 'lucide-react-native';

import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardProvider } from '@/hooks/useCardProvider';
import { cn } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import {
  getAllWalletDepositTokens,
  groupWalletDepositTokens,
  matchesWalletDepositSearch,
  resolveWalletDepositChain,
  WalletDepositToken,
} from './constants';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

const TokenSearchField = ({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) => {
  const isFilled = value.length > 0;

  return (
    <View
      className={cn(
        'h-12 flex-row items-center gap-x-2.5 rounded-[15px] border bg-card pl-4 pr-3.5',
        isFilled ? 'border-white/[0.18]' : 'border-transparent',
      )}
    >
      <Search size={20} color={isFilled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)'} />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by name or ticker"
        placeholderTextColor="rgba(255,255,255,0.4)"
        accessibilityLabel="Search tokens"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="h-full flex-1 border-0 bg-transparent px-0 text-base font-normal text-white web:outline-none"
      />
      {isFilled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => onChangeText('')}
          className="h-5 w-5 items-center justify-center rounded-full bg-[#3A3A3A] active:opacity-70"
        >
          <X size={12} strokeWidth={3} color="rgba(255,255,255,0.8)" />
        </Pressable>
      ) : null}
    </View>
  );
};

const DepositTokenRow = ({
  icon,
  ticker,
  name,
  isSelected,
  hasDivider,
  onPress,
}: {
  icon: ImageSourcePropType;
  ticker: string;
  name: string;
  isSelected: boolean;
  /** Off on a card's last row, which the card's own edge closes. */
  hasDivider: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${ticker}, ${name}`}
    onPress={onPress}
    className="h-[72px] flex-row items-center gap-x-[13px] pl-[18px] pr-5 web:transition-colors web:hover:bg-card-hover"
  >
    <Image source={icon} style={TOKEN_ICON_STYLE} contentFit="cover" />
    <View className="flex-1 gap-y-px">
      <Text className="text-lg font-semibold leading-6 text-white" numberOfLines={1}>
        {ticker}
      </Text>
      <Text className="text-sm leading-[18px] text-white/50" numberOfLines={1}>
        {name}
      </Text>
    </View>
    {isSelected ? <Check size={20} color="#94F27F" /> : <ChevronRight color="white" size={20} />}
    {hasDivider ? <View className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.08]" /> : null}
  </Pressable>
);

const NoMatchingToken = ({ onShowAll }: { onShowAll: () => void }) => (
  <View className="items-center gap-y-2 pt-14">
    <View className="h-14 w-14 items-center justify-center rounded-full bg-card">
      <Search size={24} color="rgba(255,255,255,0.6)" />
    </View>
    <View className="h-2" />
    <Text className="text-lg font-semibold text-white">No matching token</Text>
    <Text className="w-[280px] text-center text-sm text-white/50">
      Try a ticker like USDC or a name like Bitcoin.
    </Text>
    <View className="h-2" />
    <Pressable accessibilityRole="link" onPress={onShowAll} hitSlop={8}>
      <Text className="text-sm font-medium text-brand web:hover:opacity-70">
        See supported tokens
      </Text>
    </Pressable>
  </View>
);

/**
 * "Select token" — which currency the deposit address is for, and the first step
 * after "Show deposit address".
 *
 * It lists every currency some chain accepts, grouped the way Assets groups
 * holdings, with a search over ticker and name above them. The chain follows
 * from the pick (see `resolveWalletDepositChain`), and the address screen's
 * network pill is there to change it.
 */
const WalletDepositTokens = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const walletDeposit = useDepositStore(state => state.walletDeposit);
  const [query, setQuery] = useState('');

  // Only marked when the user is coming back to change it. Arriving here on the
  // way in, nothing has been chosen yet, and a tick against a currency they never
  // picked reads as a decision already made for them.
  const selected = walletDeposit.isChangingToken ? walletDeposit.symbol : undefined;

  const { provider } = useCardProvider();
  const tokens = useMemo(() => getAllWalletDepositTokens(provider), [provider]);
  const groups = useMemo(
    () =>
      groupWalletDepositTokens(tokens.filter(token => matchesWalletDepositSearch(token, query))),
    [tokens, query],
  );

  const handleSelect = (token: WalletDepositToken) => {
    Keyboard.dismiss();
    setWalletDeposit({
      symbol: token.symbol,
      chainId: resolveWalletDepositChain(token.symbol, walletDeposit.chainId, provider),
      isChangingToken: false,
    });
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  return (
    <View className="gap-y-5">
      <TokenSearchField value={query} onChangeText={setQuery} />

      {groups.length ? (
        groups.map(group => (
          <View key={group.key} className="gap-y-2">
            <Text className="text-sm font-medium text-white/50">{group.label}</Text>
            <View className="overflow-hidden rounded-[15px] bg-card">
              {group.tokens.map((token, index) => (
                <DepositTokenRow
                  key={token.symbol}
                  icon={token.icon}
                  ticker={token.symbol}
                  name={token.name}
                  isSelected={token.symbol === selected}
                  hasDivider={index < group.tokens.length - 1}
                  onPress={() => handleSelect(token)}
                />
              ))}
            </View>
          </View>
        ))
      ) : (
        <NoMatchingToken onShowAll={() => setQuery('')} />
      )}
    </View>
  );
};

export default WalletDepositTokens;
