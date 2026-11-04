import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { RhinoListNotice } from '@/lib/rhinoDeposit';

type RhinoNetworksNoticeProps = {
  notice: RhinoListNotice;
  /** The token the list is for, named in the empty state. */
  symbol: string;
  /** Whether rows are listed beside the notice (Fuse's), which changes how it reads. */
  hasRows: boolean;
  /** What the list holds, for the words: the token picker lists tokens. */
  noun?: 'networks' | 'tokens';
  /** Asks for rhino.fi's routes again. */
  onRetry: () => void;
  /** The host's frame: a card of its own under a row list, or a row inside one. */
  className?: string;
};

/**
 * Stands in a network list for the rows rhino.fi serves while they cannot be
 * offered: a loader until `/deposit/rhino/assets` answers, then a retry if it
 * failed or rhino.fi is off. Never an address of our own in their place, which
 * is the point. Also the empty state, for a token no row takes right now.
 */
const RhinoNetworksNotice = ({
  notice,
  symbol,
  hasRows,
  noun = 'networks',
  onRetry,
  className,
}: RhinoNetworksNoticeProps) => {
  if (notice === 'loading') {
    return (
      <View
        className={cn('items-center justify-center px-4 py-6', className)}
        accessibilityLabel={`Loading ${noun}`}
      >
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (notice === 'unavailable') {
    return (
      <View className={cn('items-center gap-y-3 px-4 py-6', className)}>
        <Text className="text-center text-sm text-white/70">
          {hasRows ? `Couldn’t load the other ${noun}.` : `Couldn’t load the ${noun}.`}
        </Text>
        <Button variant="secondary" className="h-10 rounded-full px-6" onPress={onRetry}>
          <Text className="text-sm font-semibold">Try again</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className={cn('items-center px-4 py-6', className)}>
      <Text className="text-center text-sm text-white/70">
        {`No network takes ${symbol} right now.`}
      </Text>
    </View>
  );
};

export default RhinoNetworksNotice;
