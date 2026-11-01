import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextStyle, View } from 'react-native';
import { Gauge, KeyRound, Pencil, Terminal, Trash2 } from 'lucide-react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  CardSheetBody,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetTextInput from '@/components/Card/NewCardDetails/SpendMode/SheetTextInput';
import { Text } from '@/components/ui/text';
import { useDeleteAiApiKey, useUpdateAiApiKey } from '@/hooks/useAiApi';
import { cn } from '@/lib/utils';

import {
  aiApiLimitProgress,
  formatAiApiCashback,
  formatAiApiLastUsed,
  formatAiApiLimit,
  formatAiApiShortDate,
  formatAiApiUsd,
} from './aiApiFormat';
import {
  AI_API_BRAND,
  AI_API_DANGER,
  AI_API_ICON_STROKE,
  AiApiDivider,
  AiApiGroup,
  AiApiIconTile,
  AiApiInfoRow,
  AiApiLimitOptions,
  AiApiProgress,
  AiApiRow,
} from './AiApiPrimitives';

import type { AiApiKey } from '@/lib/types/ai-api';

export type AiApiKeySheetView = 'details' | 'limit' | 'rename' | 'delete';

const INPUT_STYLE: TextStyle = {
  width: '100%',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.25)',
  backgroundColor: '#262626',
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
  fontFamily: 'MonaSans_500Medium',
  color: '#FFFFFF',
};

interface AiApiKeySheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  view: AiApiKeySheetView;
  onViewChange: (view: AiApiKeySheetView) => void;
  apiKey: AiApiKey | null;
  limitOptions: number[];
  maxLimitUsd: number;
  /** When monthly limits start again: midnight UTC on the 1st. */
  resetsAt: string;
  onOpenSetupGuide: () => void;
}

const PrimaryButton = ({
  label,
  onPress,
  disabled,
  isLoading,
  tone = 'brand',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  tone?: 'brand' | 'danger' | 'neutral';
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    onPress={onPress}
    disabled={disabled || isLoading}
    className={cn(
      'h-[52px] w-full flex-row items-center justify-center gap-2 rounded-full active:opacity-80',
      tone === 'brand' && 'bg-brand',
      tone === 'danger' && 'bg-[#E5484D]',
      tone === 'neutral' && 'bg-[#303030]',
      (disabled || isLoading) && 'opacity-50',
    )}
  >
    {isLoading ? (
      <ActivityIndicator size="small" color={tone === 'brand' ? 'black' : 'white'} />
    ) : null}
    <Text className={cn('text-[16px] font-bold', tone === 'brand' ? 'text-black' : 'text-white')}>
      {label}
    </Text>
  </Pressable>
);

/** Figma "7 · Key details": what the key spent, earned and has left, and what can be done with it. */
const DetailsView = ({
  apiKey,
  resetsAt,
  onViewChange,
  onOpenSetupGuide,
}: {
  apiKey: AiApiKey;
  resetsAt: string;
  onViewChange: (view: AiApiKeySheetView) => void;
  onOpenSetupGuide: () => void;
}) => (
  <View className="gap-4">
    <View className="flex-row items-center gap-3">
      <AiApiIconTile size={44}>
        <KeyRound size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />
      </AiApiIconTile>
      <View className="flex-1 gap-0.5">
        <Text className="text-[20px] font-semibold text-white" numberOfLines={1}>
          {apiKey.name}
        </Text>
        <Text className="text-[13px] text-white/55">
          sk_solid_ai_…{apiKey.last4} · Created {formatAiApiShortDate(apiKey.createdAt)}
        </Text>
      </View>
    </View>

    <View className="flex-row rounded-2xl bg-[#262626] py-3.5">
      {[
        { label: 'This month', value: formatAiApiUsd(apiKey.spentThisMonthUsd) },
        {
          label: 'Cashback',
          value: formatAiApiCashback(apiKey.cashbackThisMonthUsd),
          brand: true,
        },
        { label: 'Last used', value: formatAiApiLastUsed(apiKey.lastUsedAt) },
      ].map(stat => (
        <View key={stat.label} className="flex-1 items-center gap-1">
          <Text className="text-[12px] text-white/55">{stat.label}</Text>
          <Text
            className={cn('text-[17px] font-semibold', stat.brand ? 'text-brand' : 'text-white')}
            numberOfLines={1}
          >
            {stat.value}
          </Text>
        </View>
      ))}
    </View>

    <View className="gap-2">
      <AiApiInfoRow
        label="Monthly limit"
        value={`${formatAiApiUsd(apiKey.spentThisMonthUsd)} of ${formatAiApiLimit(
          apiKey.monthlyLimitUsd,
        )}`}
      />
      <AiApiProgress
        progress={aiApiLimitProgress(apiKey.spentThisMonthUsd, apiKey.monthlyLimitUsd)}
      />
      <Text className="text-[12px] text-white/45">Resets {formatAiApiShortDate(resetsAt)}</Text>
    </View>

    <AiApiGroup surface="sheet">
      <AiApiRow
        icon={<Gauge size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />}
        title="Change limit"
        value={formatAiApiLimit(apiKey.monthlyLimitUsd)}
        onPress={() => onViewChange('limit')}
      />
      <AiApiDivider />
      <AiApiRow
        icon={<Terminal size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />}
        title="Setup guide"
        onPress={onOpenSetupGuide}
      />
      <AiApiDivider />
      <AiApiRow
        icon={<Pencil size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />}
        title="Rename"
        onPress={() => onViewChange('rename')}
      />
    </AiApiGroup>

    <Pressable
      accessibilityRole="button"
      onPress={() => onViewChange('delete')}
      className="flex-row items-center justify-center gap-2 py-1.5 active:opacity-70"
    >
      <Trash2 size={18} color={AI_API_DANGER} strokeWidth={AI_API_ICON_STROKE} />
      <Text className="text-[16px] font-semibold text-[#FF6B6B]">Delete key</Text>
    </Pressable>
  </View>
);

/** Figma "12 · Change limit". */
const LimitView = ({
  apiKey,
  session,
  limitOptions,
  maxLimitUsd,
  resetsAt,
  onDone,
}: {
  apiKey: AiApiKey;
  session: number;
  limitOptions: number[];
  maxLimitUsd: number;
  resetsAt: string;
  onDone: () => void;
}) => {
  const { updateKey, isUpdating } = useUpdateAiApiKey();
  const [limit, setLimit] = useState(apiKey.monthlyLimitUsd);
  const [isCustom, setIsCustom] = useState(!limitOptions.includes(apiKey.monthlyLimitUsd));
  const [customText, setCustomText] = useState(String(apiKey.monthlyLimitUsd));

  // A boolean, not the options array, for the same reason as the create sheet:
  // a refetch must not undo a choice the user is in the middle of.
  const startsCustom = !limitOptions.includes(apiKey.monthlyLimitUsd);

  useEffect(() => {
    setLimit(apiKey.monthlyLimitUsd);
    setIsCustom(startsCustom);
    setCustomText(String(apiKey.monthlyLimitUsd));
  }, [session, apiKey.id, apiKey.monthlyLimitUsd, startsCustom]);

  const parsedCustom = Number.parseInt(customText, 10);
  const chosen = isCustom ? (Number.isFinite(parsedCustom) ? parsedCustom : null) : limit;
  const error =
    chosen !== null && (chosen < 1 || chosen > maxLimitUsd)
      ? `Choose between $1 and $${maxLimitUsd}`
      : null;
  const unchanged = chosen === apiKey.monthlyLimitUsd;

  const save = async () => {
    if (chosen === null || error || unchanged) return;
    const updated = await updateKey({ id: apiKey.id, monthlyLimitUsd: chosen }).catch(() => null);
    if (updated) onDone();
  };

  return (
    <View className="gap-4">
      <View className="gap-4">
        <Text className="text-[20px] font-semibold text-white">Monthly limit</Text>
        <Text className="text-[14px] text-white/60">For {apiKey.name}</Text>
      </View>
      <View className="items-center py-2">
        <Text className="text-[48px] font-semibold text-white">
          {chosen === null ? '$—' : formatAiApiLimit(chosen)}
        </Text>
      </View>
      <AiApiLimitOptions
        options={limitOptions}
        value={limit}
        custom={isCustom}
        onSelect={value => {
          setIsCustom(false);
          setLimit(value);
        }}
        onCustom={() => setIsCustom(true)}
      />
      {isCustom ? (
        <SheetTextInput
          value={customText}
          onChangeText={text => setCustomText(text.replace(/[^0-9]/g, ''))}
          placeholder={`Amount in USD, up to ${maxLimitUsd}`}
          placeholderTextColor="rgba(255,255,255,0.35)"
          keyboardType="number-pad"
          maxLength={6}
          selectionColor={AI_API_BRAND}
          accessibilityLabel="Custom monthly limit in US dollars"
          style={INPUT_STYLE}
        />
      ) : null}
      <View className="gap-2.5 rounded-2xl bg-[#262626] px-4 py-3.5">
        <AiApiInfoRow label="Spent this month" value={formatAiApiUsd(apiKey.spentThisMonthUsd)} />
        <AiApiInfoRow label="Resets" value={formatAiApiShortDate(resetsAt)} />
      </View>
      <Text
        className={cn('text-[13px] leading-[18px]', error ? 'text-[#FF6B6B]' : 'text-white/50')}
      >
        {error ??
          (apiKey.status === 'limit_reached'
            ? `Raising it starts ${apiKey.name} again right away.`
            : 'Your agents can never spend more than this in a month.')}
      </Text>
      <PrimaryButton
        label="Save limit"
        onPress={save}
        disabled={chosen === null || !!error || unchanged}
        isLoading={isUpdating}
      />
    </View>
  );
};

const RenameView = ({
  apiKey,
  session,
  onDone,
}: {
  apiKey: AiApiKey;
  session: number;
  onDone: () => void;
}) => {
  const { updateKey, isUpdating } = useUpdateAiApiKey();
  const [name, setName] = useState(apiKey.name);

  useEffect(() => setName(apiKey.name), [session, apiKey.id, apiKey.name]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== apiKey.name && !isUpdating;

  const save = async () => {
    if (!canSave) return;
    const updated = await updateKey({ id: apiKey.id, name: trimmed }).catch(() => null);
    if (updated) onDone();
  };

  return (
    <View className="gap-4">
      <Text className="text-[20px] font-semibold text-white">Rename key</Text>
      <View className="gap-2">
        <Text className="text-[13px] text-white/55">Name</Text>
        <SheetTextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          selectionColor={AI_API_BRAND}
          accessibilityLabel="Key name"
          style={INPUT_STYLE}
        />
      </View>
      <PrimaryButton label="Save" onPress={save} disabled={!canSave} isLoading={isUpdating} />
    </View>
  );
};

/** Figma "8 · Delete key (confirm)". */
const DeleteView = ({
  apiKey,
  onCancel,
  onDeleted,
}: {
  apiKey: AiApiKey;
  onCancel: () => void;
  onDeleted: () => void;
}) => {
  const deleteKey = useDeleteAiApiKey();

  return (
    <View className="items-center gap-3">
      <View className="mt-1.5" />
      <AiApiIconTile size={56} tone="danger">
        <Trash2 size={26} color={AI_API_DANGER} strokeWidth={AI_API_ICON_STROKE} />
      </AiApiIconTile>
      <Text className="mt-1 text-center text-[20px] font-semibold text-white">
        Delete “{apiKey.name}”?
      </Text>
      <Text className="text-center text-[15px] leading-[21px] text-white/60">
        Agents using this key stop working right away. This can’t be undone. Cashback on what it
        already spent is still paid.
      </Text>
      <View className="mt-2 w-full gap-3">
        <PrimaryButton
          label="Delete key"
          tone="danger"
          isLoading={deleteKey.isPending}
          onPress={() => deleteKey.mutate(apiKey.id, { onSuccess: onDeleted })}
        />
        <PrimaryButton label="Cancel" tone="neutral" onPress={onCancel} />
      </View>
    </View>
  );
};

/**
 * One key's sheet. Its views share the sheet rather than stacking sheets:
 * "Change limit" from the details swaps the content and the sheet resizes,
 * which is how the app's other multi-step sheets move.
 */
const AiApiKeySheet = ({
  isOpen,
  onOpenChange,
  view,
  onViewChange,
  apiKey,
  limitOptions,
  maxLimitUsd,
  resetsAt,
  onOpenSetupGuide,
}: AiApiKeySheetProps) => {
  const close = () => onOpenChange(false);

  return (
    <CardBottomSheet
      isOpen={isOpen && !!apiKey}
      onOpenChange={onOpenChange}
      contentKey={`ai-api-key-${view}`}
      designTop={37}
      designBottom={34}
    >
      {({ session, topPadding, presentation }: CardSheetBody) =>
        apiKey ? (
          <View
            style={{ paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) }}
            className="w-full pb-2"
          >
            {view === 'details' ? (
              <DetailsView
                apiKey={apiKey}
                resetsAt={resetsAt}
                onViewChange={onViewChange}
                onOpenSetupGuide={onOpenSetupGuide}
              />
            ) : view === 'limit' ? (
              <LimitView
                apiKey={apiKey}
                session={session}
                limitOptions={limitOptions}
                maxLimitUsd={maxLimitUsd}
                resetsAt={resetsAt}
                onDone={close}
              />
            ) : view === 'rename' ? (
              <RenameView
                apiKey={apiKey}
                session={session}
                onDone={() => onViewChange('details')}
              />
            ) : (
              <DeleteView
                apiKey={apiKey}
                onCancel={() => onViewChange('details')}
                onDeleted={close}
              />
            )}
          </View>
        ) : null
      }
    </CardBottomSheet>
  );
};

export default AiApiKeySheet;
