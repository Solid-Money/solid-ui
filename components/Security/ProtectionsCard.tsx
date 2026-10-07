import { ActivityIndicator, View } from 'react-native';
import { AlertCircle, Check, ShieldCheck } from 'lucide-react-native';

import { ProtectionSummary } from '@/components/Security/protections';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface ProtectionsCardProps {
  /** Null while the statuses it counts are still loading. */
  summary: ProtectionSummary | null;
  onAction: () => void;
  isActionBusy?: boolean;
}

/**
 * The head of the Security screen: how many of the three protections are on,
 * a bar per protection, and one button for the most useful one still off.
 */
const ProtectionsCard = ({ summary, onAction, isActionBusy }: ProtectionsCardProps) => (
  <View className="rounded-2xl bg-[#1C1C1C] p-5">
    <View className="flex-row gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#94F27F]/15">
        <ShieldCheck size={22} color="#94F27F" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-white">
          {summary
            ? `${summary.onCount} of ${summary.total} protections on`
            : 'Checking your protections'}
        </Text>
        {summary ? (
          <Text className="mt-0.5 text-[15px] leading-5 text-[#ACACAC]">{summary.message}</Text>
        ) : (
          <ActivityIndicator className="mt-2 self-start" size="small" color="#ACACAC" />
        )}
      </View>
    </View>

    {summary ? (
      <>
        <View className="mt-5 flex-row gap-2">
          {summary.items.map(item => (
            <View
              key={item.key}
              className={cn('h-1.5 flex-1 rounded-full', {
                'bg-[#94F27F]': item.isOn,
                'bg-[#3A3A3A]': !item.isOn,
              })}
            />
          ))}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
          {summary.items.map(item => (
            <View key={item.key} className="flex-row items-center gap-1.5">
              {item.isOn ? (
                <Check size={14} color="#94F27F" />
              ) : (
                <AlertCircle size={14} color="#E8A33D" />
              )}
              <Text className={cn('text-sm', item.isOn ? 'text-[#ACACAC]' : 'text-white')}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {summary.action ? (
          <Button
            variant="brand"
            className="mt-5 h-14 rounded-full"
            disabled={isActionBusy}
            onPress={onAction}
            accessibilityLabel={summary.action.label}
          >
            {isActionBusy ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Text className="text-base font-semibold text-black">{summary.action.label}</Text>
            )}
          </Button>
        ) : null}
      </>
    ) : null}
  </View>
);

export default ProtectionsCard;
