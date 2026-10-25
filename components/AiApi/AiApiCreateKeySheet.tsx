import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextStyle, View } from 'react-native';
import { Percent, Wallet } from 'lucide-react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  CardSheetBody,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetTextInput from '@/components/Card/NewCardDetails/SpendMode/SheetTextInput';
import { Text } from '@/components/ui/text';
import { useCreateAiApiKey } from '@/hooks/useAiApi';
import { cn } from '@/lib/utils';

import { formatAiApiPaidFrom, formatAiApiRate, formatAiApiUsd } from './aiApiFormat';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiLimitOptions } from './AiApiPrimitives';

/** The limit a new key starts on — the design's pre-selected option. */
const DEFAULT_LIMIT_USD = 50;
const MAX_NAME_LENGTH = 40;

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

interface AiApiCreateKeySheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  limitOptions: number[];
  maxLimitUsd: number;
  cashbackRate: number;
  /** The Wallet's billable balance on Base, USD; null when it cannot be read. */
  walletBalanceUsd: number | null;
  /** What a charge is drawn from, in order: `["USDC"]`, later `["USDC", "soUSD"]`. */
  billingTokens: string[];
  /** The key exists; its secret is handed on to be shown once. */
  onCreated: (secret: string, name: string) => void;
}

const CreateKeyBody = ({
  session,
  topPadding,
  presentation,
  limitOptions,
  maxLimitUsd,
  cashbackRate,
  walletBalanceUsd,
  billingTokens,
  onCreated,
}: CardSheetBody & Omit<AiApiCreateKeySheetProps, 'isOpen' | 'onOpenChange'>) => {
  const { createKey, isCreating } = useCreateAiApiKey();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState<number | null>(DEFAULT_LIMIT_USD);
  const [isCustom, setIsCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  // A number, not the options array: every refetch of the overview makes a new
  // array, and resetting on that would wipe a name mid-typing.
  const defaultLimit = limitOptions.includes(DEFAULT_LIMIT_USD)
    ? DEFAULT_LIMIT_USD
    : (limitOptions[0] ?? null);

  useEffect(() => {
    setName('');
    setLimit(defaultLimit);
    setIsCustom(false);
    setCustomText('');
  }, [session, defaultLimit]);

  const customValue = Number.parseInt(customText, 10);
  const chosenLimit = isCustom ? (Number.isFinite(customValue) ? customValue : null) : limit;
  const limitError =
    chosenLimit !== null && (chosenLimit < 1 || chosenLimit > maxLimitUsd)
      ? `Choose between $1 and $${maxLimitUsd}`
      : null;
  const canCreate = name.trim().length > 0 && chosenLimit !== null && !limitError && !isCreating;

  const submit = async () => {
    if (!canCreate || chosenLimit === null) return;
    const result = await createKey({ name: name.trim(), monthlyLimitUsd: chosenLimit }).catch(
      () => null,
    );
    if (result) onCreated(result.secret, result.key.name);
  };

  return (
    <View
      style={{ paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) }}
      className="w-full gap-4 pb-2"
    >
      <View className="gap-4">
        <Text className="text-[20px] font-semibold text-white">Create API key</Text>
        <Text className="text-[14px] leading-5 text-white/60">
          Give it a name so you know which agent is using it.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-white/55">Name</Text>
        <SheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="My laptop"
          placeholderTextColor="rgba(255,255,255,0.35)"
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="sentences"
          returnKeyType="done"
          selectionColor={AI_API_BRAND}
          accessibilityLabel="Key name"
          style={INPUT_STYLE}
        />
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-white/55">Monthly limit</Text>
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
        <Text
          className={cn(
            'text-[13px] leading-[18px]',
            limitError ? 'text-[#FF6B6B]' : 'text-white/50',
          )}
        >
          {limitError ??
            'This key stops when it reaches the limit, so your agents can never spend more. Change it anytime.'}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-white/55">Paid from</Text>
        <View className="flex-row items-center gap-3 rounded-[14px] bg-[#262626] px-3.5 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-[#333333]">
            <Wallet size={18} color="white" strokeWidth={AI_API_ICON_STROKE} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[16px] font-semibold text-white">Wallet</Text>
            <Text className="text-[13px] text-white/55">
              {walletBalanceUsd === null
                ? formatAiApiPaidFrom(billingTokens)
                : `${formatAiApiUsd(walletBalanceUsd)} available · ${formatAiApiPaidFrom(
                    billingTokens,
                  )}`}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-2.5 rounded-[14px] bg-brand/10 px-3.5 py-3">
        <Percent size={18} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
        <Text className="flex-1 text-[14px] leading-[19px] text-brand">
          You get {formatAiApiRate(cashbackRate)} back on everything this key spends.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canCreate }}
        onPress={submit}
        disabled={!canCreate}
        className={cn(
          'h-[52px] w-full flex-row items-center justify-center gap-2 rounded-full bg-brand active:opacity-80',
          !canCreate && 'opacity-50',
        )}
      >
        {isCreating ? <ActivityIndicator size="small" color="black" /> : null}
        <Text className="text-[16px] font-bold text-black">Create key</Text>
      </Pressable>
    </View>
  );
};

/**
 * Create API key (Figma "3 · Create key"). When the Wallet has not allowed
 * charges yet — or the new limit needs a bigger daily allowance — creating asks
 * for one passkey signature first, then makes the key.
 */
const AiApiCreateKeySheet = ({ isOpen, onOpenChange, ...props }: AiApiCreateKeySheetProps) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey="ai-api-create-key"
    designTop={37}
    designBottom={34}
  >
    {body => <CreateKeyBody {...body} {...props} />}
  </CardBottomSheet>
);

export default AiApiCreateKeySheet;
