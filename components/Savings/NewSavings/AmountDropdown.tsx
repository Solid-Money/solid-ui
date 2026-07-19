import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn, formatNumber } from '@/lib/utils';

import SelectSheet from './SelectSheet';

/** Preset principals offered by the "Simulate your savings" amount dropdown. */
export const SIMULATE_AMOUNTS = [100, 1000, 10000] as const;

const formatAmount = (amount: number) => `$${formatNumber(amount, 0, 0)}`;

// Figma: Mona Sans / Bold 700 / 18px / line-height 100%.
const AMOUNT_STYLE = { fontFamily: 'MonaSans_700Bold', fontSize: 18, lineHeight: 18 } as const;

type AmountPillProps = {
  amount: number;
} & React.ComponentProps<typeof Pressable>;

/** Compact "$10,000 ⌄" pill that opens the amount selector. */
export const AmountPill = React.forwardRef<View, AmountPillProps>(({ amount, ...props }, ref) => {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel="Change simulation amount"
      className="flex-row items-center gap-1 transition-all active:scale-95 active:opacity-80"
      {...props}
    >
      <Text className="text-white" style={AMOUNT_STYLE}>
        {formatAmount(amount)}
      </Text>
      <ChevronDown size={18} color="rgba(255,255,255,0.6)" />
    </Pressable>
  );
});
AmountPill.displayName = 'AmountPill';

interface AmountDropdownProps {
  amount: number;
  onSelect: (amount: number) => void;
  className?: string;
}

/**
 * "$10,000 ⌄" dropdown for the simulation card. Opens a sheet with the preset
 * amounts (100 / 1,000 / 10,000) as buttons in a single row.
 */
const AmountDropdown = ({ amount, onSelect, className }: AmountDropdownProps) => {
  return (
    <View className={cn('items-end', className)}>
      <SelectSheet trigger={<AmountPill amount={amount} />} title="Simulate amount">
        {dismiss => (
          <View className="flex-row gap-2 px-5 py-2">
            {SIMULATE_AMOUNTS.map(preset => {
              const active = preset === amount;
              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    onSelect(preset);
                    dismiss();
                  }}
                  className={cn(
                    'flex-1 items-center rounded-full py-3 transition-all active:scale-95',
                    active ? 'bg-white' : 'bg-[#262626]',
                  )}
                >
                  <Text className={cn('text-base font-bold', active ? 'text-black' : 'text-white')}>
                    {formatAmount(preset)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SelectSheet>
    </View>
  );
};

export default AmountDropdown;
