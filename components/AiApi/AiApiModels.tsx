import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronRight, Percent, X } from 'lucide-react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  type CardSheetBody,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

import {
  aiApiModelDiscount,
  aiApiModelIsFree,
  aiApiModelTag,
  formatAiApiCashbackNote,
  formatAiApiCount,
  formatAiApiTokenPrice,
} from './aiApiFormat';
import AiApiModelLogo from './AiApiModelLogo';
import { AI_API_BRAND, AI_API_ICON_STROKE } from './AiApiPrimitives';

import type { AiApiCashbackTier, AiApiModel } from '@/lib/types/ai-api';

/** How many models the intro lists: the whole launch list, kept short if it ever grows. */
const MODELS_SHOWN = 6;

const ANTSEED_DOCS_URL = 'https://antseed.com/docs/overview/';

/** Figma "Points" in the Antseed banner. */
const ANTSEED_POINTS = [
  'One fixed price per model, set by Solid',
  'We don’t store your prompts or answers',
  'Only usage is kept, for billing',
];

/** What the green tag says to a screen reader: the saving, or that the model is free. */
const tagLabel = (model: AiApiModel): string | null => {
  if (aiApiModelIsFree(model)) return 'Free';
  const discount = aiApiModelDiscount(model);
  return discount ? `${discount}% below the official price` : null;
};

/**
 * The green tag beside a model. The intro's list draws it a size up from the
 * price sheet's, as Figma does ("Saving pill" against "Tag — vs official").
 */
const ModelTag = ({ label, variant }: { label: string; variant: 'list' | 'sheet' }) => (
  <View
    className={cn(
      'rounded-full px-2.5',
      variant === 'list'
        ? 'bg-[rgba(148,242,127,0.14)] py-[5px]'
        : 'bg-[rgba(148,242,127,0.12)] py-1',
    )}
  >
    <Text
      className={cn(
        'text-brand',
        variant === 'list' ? 'text-[14px] font-semibold' : 'text-[13px] font-medium',
      )}
    >
      {label}
    </Text>
  </View>
);

/** A model's name, then its maker when the dashboard names one. */
const ModelName = ({ model, size }: { model: AiApiModel; size: 'list' | 'sheet' }) => (
  <View className="flex-1 gap-px">
    <Text
      className={cn('font-medium text-white', size === 'list' ? 'text-[15px]' : 'text-[16px]')}
      numberOfLines={1}
    >
      {model.name}
    </Text>
    {model.provider ? (
      <Text className="text-[13px] text-white/50" numberOfLines={1}>
        {model.provider}
      </Text>
    ) : null}
  </View>
);

/** The trailing chevron of a card's link row. */
const LinkRow = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="flex-row items-center gap-1 pt-0.5 active:opacity-70"
  >
    <Text className="flex-1 text-[15px] font-medium text-white">{label}</Text>
    <ChevronRight size={18} color="white" strokeWidth={AI_API_ICON_STROKE} />
  </Pressable>
);

/**
 * Figma "Models" on the intro: the models a key can call, each tagged with how
 * far below its maker's list price ours is, and a way into every price.
 */
export const AiApiModelList = ({
  models,
  onSeePrices,
}: {
  models: AiApiModel[];
  onSeePrices: () => void;
}) => {
  if (models.length === 0) return null;
  const shown = models.slice(0, MODELS_SHOWN);
  const anyTag = shown.some(model => aiApiModelTag(model) !== null);

  return (
    <View className="gap-3.5 rounded-twice bg-card px-4 pb-1 pt-[18px]">
      <View className="flex-row items-end gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-semibold text-white">Models</Text>
          <Text className="text-[13px] text-white/50">All on one API key</Text>
        </View>
        {anyTag ? <Text className="text-[13px] text-white/50">vs official price</Text> : null}
      </View>

      <View className="gap-4">
        {shown.map(model => {
          const tag = aiApiModelTag(model);
          return (
            <View
              key={model.id}
              className="h-10 flex-row items-center gap-3"
              accessible
              accessibilityLabel={[
                model.provider ? `${model.name}, ${model.provider}` : model.name,
                tagLabel(model),
              ]
                .filter(Boolean)
                .join('. ')}
            >
              <AiApiModelLogo model={model} />
              <ModelName model={model} size="list" />
              {tag ? <ModelTag label={tag} variant="list" /> : null}
            </View>
          );
        })}
      </View>

      <View className="h-px bg-white/[0.08]" />
      <View className="pb-3">
        <LinkRow label="See prices" onPress={onSeePrices} />
      </View>
    </View>
  );
};

/** Figma "Banner — About Antseed": who runs the models behind the key, and what we keep. */
export const AiApiAntseedCard = () => (
  <View className="gap-3.5 rounded-twice bg-card px-4 pb-4 pt-[18px]">
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[rgba(148,242,127,0.12)]">
        <Image
          source={getAsset('images/ai-api/antseed-ant.svg')}
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
      </View>
      <View className="flex-1 gap-px">
        <Text className="text-[16px] font-semibold text-white">Powered by Antseed</Text>
        <Text className="text-[13px] text-white/50">An open market for AI models</Text>
      </View>
    </View>
    <Text className="text-[14px] leading-5 text-white/70">
      Your requests run on Antseed’s network of AI providers. Solid sets one fixed price for each
      model, so you always know what you’ll pay.
    </Text>
    <View className="gap-2.5">
      {ANTSEED_POINTS.map(point => (
        <View key={point} className="flex-row items-center gap-2.5">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-[rgba(148,242,127,0.12)]">
            <Check size={14} color={AI_API_BRAND} strokeWidth={2.5} />
          </View>
          <Text className="flex-1 text-[14px] text-white/85">{point}</Text>
        </View>
      ))}
    </View>
    <LinkRow
      label="Learn about Antseed"
      onPress={() => void Linking.openURL(ANTSEED_DOCS_URL).catch(() => undefined)}
    />
  </View>
);

/** What a screen reader says for one model's card: everything the card shows. */
const modelCardLabel = (model: AiApiModel): string => {
  const name = model.provider ? `${model.name}, ${model.provider}` : model.name;
  // Every cell reads "Free" already; saying so once is the whole card.
  if (aiApiModelIsFree(model)) return `${name}. Free`;
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

/** Figma "AI agents / Model price card": a model, its tag, and our three prices. */
const ModelPriceCard = ({ model }: { model: AiApiModel }) => {
  const tag = aiApiModelTag(model);
  return (
    <View className="gap-3" accessible accessibilityLabel={modelCardLabel(model)}>
      <View className="flex-row items-center gap-3">
        <AiApiModelLogo model={model} />
        <ModelName model={model} size="sheet" />
        {tag ? <ModelTag label={tag} variant="sheet" /> : null}
      </View>
      <View className="flex-row gap-2">
        <PriceCell label="Input" price={model.inputUsdPerMTok} />
        {/* An older backend, or a model the dashboard priced no cache for, has no cell. */}
        {model.cachedInputUsdPerMTok == null ? null : (
          <PriceCell label="Cached input" price={model.cachedInputUsdPerMTok} />
        )}
        <PriceCell label="Output" price={model.outputUsdPerMTok} />
      </View>
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
