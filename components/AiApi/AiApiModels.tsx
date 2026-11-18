import { Pressable, View } from 'react-native';
import { Percent, X } from 'lucide-react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  type CardSheetBody,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Text } from '@/components/ui/text';

import {
  aiApiModelDiscount,
  aiApiModelIsFree,
  aiApiModelTag,
  formatAiApiCashbackNote,
  formatAiApiCount,
  formatAiApiModelSpeed,
  formatAiApiTokenPrice,
} from './aiApiFormat';
import AiApiModelLogo from './AiApiModelLogo';
import { AI_API_BRAND, AI_API_ICON_STROKE } from './AiApiPrimitives';

import type { AiApiCashbackTier, AiApiModel } from '@/lib/types/ai-api';

/** What the green tag says to a screen reader: the saving, or that the model is free. */
const tagLabel = (model: AiApiModel): string | null => {
  if (aiApiModelIsFree(model)) return 'Free';
  const discount = aiApiModelDiscount(model);
  return discount ? `${discount}% below the official price` : null;
};

const ModelTag = ({ label }: { label: string }) => (
  <View className="rounded-full bg-[rgba(148,242,127,0.12)] px-2.5 py-1">
    <Text className="text-[13px] font-medium text-brand">{label}</Text>
  </View>
);

const ModelName = ({ model }: { model: AiApiModel }) => (
  <View className="flex-1 gap-px">
    <Text className="text-[16px] font-medium text-white" numberOfLines={1}>
      {model.name}
    </Text>
    {model.provider ? (
      <Text className="text-[13px] text-white/50" numberOfLines={1}>
        {model.provider}
      </Text>
    ) : null}
  </View>
);

/** What a screen reader says for one model's card: everything the card shows. */
const modelCardLabel = (model: AiApiModel): string => {
  const name = model.provider ? `${model.name}, ${model.provider}` : model.name;
  // Read out as words: "about 85 tokens a second", not "tilde 85 tokens slash s".
  const speed = formatAiApiModelSpeed(model)
    ?.replace('~', 'about ')
    .replace('tokens/s', 'tokens a second');
  // Every cell reads "Free" already; saying so once is the whole card.
  if (aiApiModelIsFree(model)) return [name, 'Free', speed].filter(Boolean).join('. ');
  const cached =
    model.cachedInputUsdPerMTok == null
      ? ''
      : `, cached input ${formatAiApiTokenPrice(model.cachedInputUsdPerMTok)}`;
  return [
    name,
    `Input ${formatAiApiTokenPrice(model.inputUsdPerMTok)}${cached}, output ${formatAiApiTokenPrice(
      model.outputUsdPerMTok,
    )}, per million tokens`,
    tagLabel(model),
    speed,
  ]
    .filter(Boolean)
    .join('. ');
};

const PriceCell = ({ label, price }: { label: string; price: number }) => (
  <View className="flex-1 gap-0.5 rounded-xl bg-[#262626] px-3 py-2.5">
    <Text className="text-[12px] text-white/50">{label}</Text>
    <Text className="text-[15px] font-medium text-white" numberOfLines={1}>
      {formatAiApiTokenPrice(price)}
    </Text>
  </View>
);

/**
 * Figma "AI agents / Model price card": a model, its tag, our three prices,
 * and how fast it has been answering lately when that was measured.
 */
const ModelPriceCard = ({ model }: { model: AiApiModel }) => {
  const tag = aiApiModelTag(model);
  const speed = formatAiApiModelSpeed(model);
  return (
    <View className="gap-3" accessible accessibilityLabel={modelCardLabel(model)}>
      <View className="flex-row items-center gap-3">
        <AiApiModelLogo model={model} />
        <ModelName model={model} />
        {tag ? <ModelTag label={tag} /> : null}
      </View>
      <View className="flex-row gap-2">
        <PriceCell label="Input" price={model.inputUsdPerMTok} />
        {/* An older backend, or a model the dashboard priced no cache for, has no cell. */}
        {model.cachedInputUsdPerMTok == null ? null : (
          <PriceCell label="Cached input" price={model.cachedInputUsdPerMTok} />
        )}
        <PriceCell label="Output" price={model.outputUsdPerMTok} />
      </View>
      {/* Too few recent requests, or an older backend, measures nothing: no line. */}
      {speed ? <Text className="text-[13px] text-white/50">{speed}</Text> : null}
    </View>
  );
};

const ModelsSheetBody = ({
  models,
  cashbackRate,
  cashbackTiers,
  cashbackMonthlyCapUsd,
  onClose,
  topPadding,
  presentation,
}: CardSheetBody & {
  models: AiApiModel[];
  cashbackRate: number;
  cashbackTiers?: AiApiCashbackTier[];
  cashbackMonthlyCapUsd: number;
  onClose: () => void;
}) => {
  const inset = sheetBodyInset(presentation);
  const count = models.length;
  const anyTag = models.some(model => aiApiModelTag(model) !== null);

  return (
    <View style={{ paddingTop: topPadding }} className="w-full gap-4 pb-2">
      <View style={{ paddingHorizontal: inset }} className="gap-1.5">
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-[20px] font-semibold text-white">Models & prices</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full bg-[#303030] active:opacity-70"
          >
            <X size={16} color="white" strokeWidth={AI_API_ICON_STROKE} />
          </Pressable>
        </View>
        <Text className="text-[14px] leading-[19px] text-white/60">
          {formatAiApiCount(count)} {count === 1 ? 'model' : 'models'} on one API key. Prices are
          per 1M tokens and paid from your Wallet.
          {anyTag ? ' The green tag shows how much less you pay than the official price.' : ''}
        </Text>
      </View>

      <View style={{ paddingHorizontal: inset }} className="gap-[22px]">
        {models.map(model => (
          <ModelPriceCard key={model.id} model={model} />
        ))}
      </View>

      <View style={{ paddingHorizontal: inset }}>
        <View className="flex-row items-start gap-2.5 rounded-[14px] bg-[rgba(148,242,127,0.1)] px-3.5 py-3">
          <Percent size={18} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
          <Text className="flex-1 text-[14px] leading-[19px] text-brand">
            {formatAiApiCashbackNote({ cashbackRate, cashbackTiers, cashbackMonthlyCapUsd })}
          </Text>
        </View>
      </View>
    </View>
  );
};

/** Figma "2b · Models & prices": every model the key can call, with our price for each. */
export const AiApiModelsSheet = ({
  isOpen,
  onOpenChange,
  models,
  cashbackRate,
  cashbackTiers,
  cashbackMonthlyCapUsd,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  models: AiApiModel[];
  cashbackRate: number;
  /** Every tier's terms, for the note's caps; missing on an older backend. */
  cashbackTiers?: AiApiCashbackTier[];
  /** The user's own cap, the note's fallback without every tier's. */
  cashbackMonthlyCapUsd: number;
}) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey="ai-api-models"
    designTop={21}
    designBottom={34}
    scrollable
  >
    {body => (
      <ModelsSheetBody
        {...body}
        models={models}
        cashbackRate={cashbackRate}
        cashbackTiers={cashbackTiers}
        cashbackMonthlyCapUsd={cashbackMonthlyCapUsd}
        onClose={() => onOpenChange(false)}
      />
    )}
  </CardBottomSheet>
);
