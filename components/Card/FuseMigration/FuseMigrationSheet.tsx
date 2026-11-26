import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { formatMigrationAmount, FuseMigrationItem } from '@/lib/fuseMigration';
import getTokenIcon from '@/lib/getTokenIcon';

import type { FuseMigrationOutcome } from '@/hooks/useFuseMigration';

interface FuseMigrationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: FuseMigrationItem[];
  movableUsd: number;
  needsBaseEnable: boolean;
  isMigrating: boolean;
  isEnablingBase: boolean;
  error?: string;
  onMigrate: () => Promise<FuseMigrationOutcome | undefined>;
  /** Where the sheet was opened from, for the funnel. */
  source: 'popup' | 'banner';
}

const formatUsd = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The token list behind "Move to Base": every asset the Safe holds on Fuse, its amount, and one
 * Migrate button that moves all of them.
 *
 * Vault shares below the paymaster's minimum are listed as staying on Fuse rather than hidden, so
 * the cardholder is not left wondering why a balance did not move.
 */
const FuseMigrationSheet = ({
  isOpen,
  onClose,
  items,
  movableUsd,
  needsBaseEnable,
  isMigrating,
  isEnablingBase,
  error,
  onMigrate,
  source,
}: FuseMigrationSheetProps) => {
  const [isDone, setIsDone] = useState(false);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      setIsDone(false);
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    track(TRACKING_EVENTS.FUSE_MIGRATION_SHEET_OPENED, {
      source,
      usd: movableUsd,
      needs_base_enable: needsBaseEnable,
    });
  }, [isOpen, source, movableUsd, needsBaseEnable]);

  const movable = items.filter(item => item.movable);
  const staying = items.filter(item => !item.movable);
  // One Fuse operation per stablecoin (the backend opens one deposit session per transaction),
  // with the vault bridges riding on the first; plus Base, when it has to be turned on first.
  const fuseOperations = Math.max(
    1,
    movable.filter(item => item.route === 'deposit_address').length,
  );
  const approvals = fuseOperations + (needsBaseEnable ? 1 : 0);

  const handleMigrate = async () => {
    const outcome = await onMigrate();
    if (outcome === 'migrated') setIsDone(true);
  };

  const busyLabel = isEnablingBase ? 'Turning on Base…' : 'Moving…';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isMigrating && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[90vw] max-w-[400px] gap-0 overflow-hidden p-0"
        style={styles.sheet}
      >
        <View className="flex-row items-start justify-between gap-4 px-6 pt-6">
          <View className="flex-1 gap-1.5">
            <DialogTitle className="text-[22px] font-semibold text-white">
              {isDone ? 'On its way to Base' : 'Move your funds to Base'}
            </DialogTitle>
            <Text className="text-[15px] leading-[21px] text-[#ACACAC]">
              {isDone
                ? 'Your funds usually arrive on Base within a few minutes. They show in Activity as they land.'
                : 'Your card now spends from Base. Move these from Fuse in one tap. No fees, and the bridge is on us.'}
            </Text>
          </View>
          {!isMigrating ? <DialogCloseButton className="bg-white/10" /> : null}
        </View>

        {isDone ? (
          <View className="items-center px-6 py-8">
            <CheckCircle2 color="#94F27F" size={56} />
          </View>
        ) : (
          <View className="gap-2 px-6 pt-5">
            {movable.map(item => (
              <View
                key={item.symbol}
                className="flex-row items-center justify-between rounded-2xl bg-[#1F1F1F] px-4 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <RenderTokenIcon
                    tokenIcon={getTokenIcon({ tokenSymbol: item.symbol, size: 36 })}
                    size={36}
                  />
                  <View>
                    <Text className="text-base font-semibold text-white">{item.symbol}</Text>
                    <Text className="text-[13px] text-muted-foreground">On Fuse</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-base font-semibold text-white">
                    {formatMigrationAmount(item)}
                  </Text>
                  {item.valueUsd > 0 ? (
                    <Text className="text-[13px] text-muted-foreground">
                      {formatUsd(item.valueUsd)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            {staying.length > 0 ? (
              <Text className="pt-1 text-[13px] leading-[18px] text-muted-foreground">
                {staying.map(item => `${formatMigrationAmount(item)} ${item.symbol}`).join(', ')}{' '}
                {staying.length === 1 ? 'is' : 'are'} below the bridge minimum and will stay on
                Fuse.
              </Text>
            ) : null}
            {approvals > 1 ? (
              <Text className="pt-1 text-[13px] leading-[18px] text-muted-foreground">
                {needsBaseEnable
                  ? 'Base isn’t on for your card yet, so we’ll turn it on first. '
                  : ''}
                You’ll approve {approvals === 2 ? 'twice' : `${approvals} times`}.
              </Text>
            ) : null}
            {error ? (
              <Text className="pt-1 text-[13px] leading-[18px] text-red-400">{error}</Text>
            ) : null}
          </View>
        )}

        <View className="w-full p-6">
          {isDone ? (
            <Button variant="brand" className="h-[52px] rounded-[30px]" onPress={onClose}>
              <Text className="text-base font-semibold text-black">Done</Text>
            </Button>
          ) : (
            <Button
              variant="brand"
              className="h-[52px] rounded-[30px]"
              disabled={isMigrating || movable.length === 0}
              onPress={handleMigrate}
              accessibilityLabel="Migrate"
            >
              {isMigrating ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="black" size="small" />
                  <Text className="text-base font-semibold text-black">{busyLabel}</Text>
                </View>
              ) : (
                <Text className="text-base font-semibold text-black">Migrate</Text>
              )}
            </Button>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#161616',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    borderWidth: 1,
  },
});

export default FuseMigrationSheet;
