import { useEffect, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { ActivityTab } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActivityFilter } from '@/lib/utils/unifiedActivity';

const FILTERS: { label: string; value: ActivityFilter }[] = [
  { label: 'All', value: ActivityTab.ALL },
  { label: 'Wallet', value: ActivityTab.WALLET },
  { label: 'Card', value: ActivityTab.CARD },
];

type ActivityFiltersProps = {
  value: ActivityFilter;
  onChange: (filter: ActivityFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  isSearchOpen: boolean;
  onSearchOpenChange: (isOpen: boolean) => void;
  /**
   * Without a card there is nothing for Wallet and Card to separate, so only the
   * search affordance is shown.
   */
  showSourceFilters?: boolean;
};

/**
 * The Activity screen's chip row: All / Wallet / Card plus search (Figma
 * 24781:7686). Searching takes the row over rather than sitting under it — the
 * chips are a filter of the same list, and having both compete for the top of
 * the screen pushed the results below the fold.
 */
export default function ActivityFilters({
  value,
  onChange,
  query,
  onQueryChange,
  isSearchOpen,
  onSearchOpenChange,
  showSourceFilters = true,
}: ActivityFiltersProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchOpen) inputRef.current?.focus();
  }, [isSearchOpen]);

  const closeSearch = () => {
    onQueryChange('');
    onSearchOpenChange(false);
  };

  if (isSearchOpen) {
    return (
      <Pressable
        onPress={() => inputRef.current?.focus()}
        className="h-[41px] flex-row items-center gap-3 rounded-full bg-card px-4"
      >
        <Search size={15} color="rgba(255,255,255,0.7)" />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search activity"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
          className="h-full flex-1 bg-transparent text-base text-white web:focus:outline-none"
        />
        <Pressable
          accessibilityLabel="Close search"
          accessibilityRole="button"
          onPress={closeSearch}
          hitSlop={8}
          className="h-6 w-6 items-center justify-center rounded-full bg-[#2A2A2A] active:opacity-70"
        >
          <X size={12} color="white" />
        </Pressable>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-start gap-2">
      {showSourceFilters &&
        FILTERS.map(filter => {
          const isActive = value === filter.value;
          return (
            <Pressable
              key={filter.value}
              accessibilityLabel={`Show ${filter.label.toLowerCase()} activity`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(filter.value)}
              className={cn(
                'h-[41px] justify-center rounded-full px-[14px] active:opacity-80',
                isActive ? 'bg-white' : 'bg-card',
              )}
            >
              <Text
                className={cn('text-base font-medium', isActive ? 'text-black' : 'text-white/70')}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      <Pressable
        accessibilityLabel="Search activity"
        accessibilityRole="button"
        onPress={() => onSearchOpenChange(true)}
        className="h-[41px] w-[41px] items-center justify-center rounded-full bg-card active:opacity-80"
      >
        <Search size={15} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}
