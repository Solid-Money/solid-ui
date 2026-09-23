import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { TierUpgradeRoute } from '@/lib/tierUpgrade';

const ROUTE_LABEL: Record<TierUpgradeRoute, string> = {
  cash: 'Cash',
  lock: 'Locked FUSE',
};

interface UpgradeRouteSwitchProps {
  routes: TierUpgradeRoute[];
  selected: TierUpgradeRoute;
  onSelect: (route: TierUpgradeRoute) => void;
}

/**
 * How the tier is being paid for.
 *
 * Renders whatever routes are actually on offer, which is why it takes a list
 * rather than a boolean: Prime is sold both ways and shows two segments, Ultra
 * is FUSE-only and shows one full-width segment. A disabled second segment
 * would advertise a way to buy Ultra that does not exist.
 *
 * Draws nothing at all for a single route on a tier that has no alternative —
 * a switch with one option is a label, and the row above it already says what
 * this is.
 */
const UpgradeRouteSwitch = ({ routes, selected, onSelect }: UpgradeRouteSwitchProps) => {
  if (routes.length === 0) return null;

  return (
    <View className="h-[50px] flex-row items-center rounded-full bg-[#1C1C1C] p-1">
      {routes.map(route => {
        const isSelected = route === selected;

        return (
          <Pressable
            key={route}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Pay with ${ROUTE_LABEL[route]}`}
            onPress={() => onSelect(route)}
            className={cn(
              'h-[42px] flex-1 items-center justify-center rounded-full transition-all active:opacity-80',
              isSelected && 'bg-white',
            )}
          >
            {/* The colour is a style, not a class. `Text` composes its own
                class with whatever the surrounding text context provides, and
                a selected label that loses that merge is white on white — an
                empty pill, which is what this rendered as. An inline style
                cannot be merged away. Every other black-on-light label in the
                rewards screens is written the same way. */}
            <Text
              className={cn('text-[16px] leading-5', isSelected ? 'font-semibold' : 'font-medium')}
              style={isSelected ? styles.selectedLabel : styles.label}
            >
              {ROUTE_LABEL[route]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { color: '#FFFFFF' },
  selectedLabel: { color: '#000000' },
});

export default UpgradeRouteSwitch;
