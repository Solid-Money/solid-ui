import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronRight, Percent, Search, X } from 'lucide-react-native';

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
  formatAiApiDiscount,
  formatAiApiRate,
  formatAiApiTokenPrice,
} from './aiApiFormat';
import AiApiModelLogo from './AiApiModelLogo';
import { AI_API_BRAND, AI_API_ICON_STROKE } from './AiApiPrimitives';

import type { AiApiModel } from '@/lib/types/ai-api';

/** How many models the intro's card shows before "See all". */
const MOST_USED_SHOWN = 4;

const ANTSEED_DOCS_URL = 'https://antseed.com/docs/overview/';

/** A model's name, then its maker; the discount follows the maker when there is one. */
const ModelName = ({ model, showDiscount }: { model: AiApiModel; showDiscount: boolean }) => {
  const discount = showDiscount ? aiApiModelDiscount(model) : null;
  return (
    <View className="flex-1 gap-px">
      <Text className="text-[15px] font-medium text-white" numberOfLines={1}>
        {model.name}
      </Text>
      {model.provider || discount ? (
        <View className="flex-row items-center gap-1.5">
          {model.provider ? (
            <Text className="text-[13px] text-white/50" numberOfLines={1}>
              {model.provider}
            </Text>
          ) : null}
          {discount ? (
            <Text className="text-[13px] font-medium text-brand">
              {formatAiApiDiscount(discount)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

/** The trailing chevron of a card's link row. */
const LinkRow = ({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    onPress={onPress}
    className="flex-row items-center gap-1 pt-0.5 active:opacity-70"
  >
    <Text className="flex-1 text-[15px] font-medium text-white">{label}</Text>
    <ChevronRight size={18} color="white" strokeWidth={AI_API_ICON_STROKE} />
  </Pressable>
);

/**
 * Figma "Most used models": the four models used most across Solid, each with
 * how far below its maker's list price ours is, and a way into every price.
 */
export const AiApiMostUsedModels = ({
  models,
  onSeeAll,
}: {
  models: AiApiModel[];
  onSeeAll: () => void;
}) => {
  if (models.length === 0) return null;
  const shown = models.slice(0, MOST_USED_SHOWN);
  const anyDiscount = shown.some(model => aiApiModelDiscount(model) !== null);

  return (
    <View className="gap-3.5 rounded-twice bg-card px-4 pb-1 pt-[18px]">
      <View className="flex-row items-end gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-semibold text-white">Most used models</Text>
          <Text className="text-[13px] text-white/50">All on one API key</Text>
        </View>
        {anyDiscount ? <Text className="text-[13px] text-white/50">vs official price</Text> : null}
      </View>

      <View className="gap-4">
        {shown.map(model => {
          const discount = aiApiModelDiscount(model);
          return (
            <View key={model.id} className="h-10 flex-row items-center gap-3">
              <AiApiModelLogo model={model} />
              <ModelName model={model} showDiscount={false} />
              {discount ? (
                <View className="rounded-full bg-[rgba(148,242,127,0.14)] px-2.5 py-[5px]">
                  <Text className="text-[14px] font-semibold text-brand">
                    {formatAiApiDiscount(discount)}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View className="h-px bg-white/[0.08]" />
      <View className="pb-3">
        <LinkRow
          label={
            models.length === 1 ? 'See its prices' : `See all ${models.length} models & prices`
          }
          onPress={onSeeAll}
        />
      </View>
    </View>
  );
};

/** Figma "Banner — About AntSeed": who runs the models behind the key. */
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
      Independent sellers run AI models on Antseed and compete on price, so you often pay far less
      than the official rates. One Solid key works with all of them.
    </Text>
    <LinkRow
      label="How Antseed works"
      onPress={() => void Linking.openURL(ANTSEED_DOCS_URL).catch(() => undefined)}
    />
  </View>
);

/** What a screen reader says for one row: everything the row shows, discount included. */
const modelRowLabel = (model: AiApiModel): string => {
  const discount = aiApiModelDiscount(model);
  return [
    model.provider ? `${model.name}, ${model.provider}` : model.name,
    `input ${formatAiApiTokenPrice(model.inputUsdPerMTok)}, output ${formatAiApiTokenPrice(
      model.outputUsdPerMTok,
    )} per million tokens`,
    discount ? `${discount}% below the official price` : null,
  ]
    .filter(Boolean)
    .join('. ');
};

type Sort = 'most_used' | 'lowest_price';

const SORT_LABELS: Record<Sort, string> = {
  most_used: 'Most used',
  lowest_price: 'Lowest price',
};

/** What a typical agent request costs, for "Lowest price": input and output together. */
const blendedPrice = (model: AiApiModel) => model.inputUsdPerMTok + model.outputUsdPerMTok;

/** Providers in the order their first model appears, each with that model for its logo. */
const providersOf = (models: AiApiModel[]): AiApiModel[] => {
  const seen = new Set<string>();
  return models.filter(model => {
    if (!model.provider || seen.has(model.provider)) return false;
    seen.add(model.provider);
    return true;
  });
};

const Chip = ({
  label,
  selected,
  onPress,
  logo,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  logo?: AiApiModel;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    onPress={onPress}
    className={cn(
      'flex-row items-center gap-1.5 rounded-full py-2 pr-3.5 active:opacity-70',
      logo ? 'pl-2' : 'pl-3.5',
      selected ? 'bg-white' : 'bg-[#262626]',
    )}
  >
    {logo ? <AiApiModelLogo model={logo} size={20} /> : null}
    <Text
      className={cn(
        'text-[14px]',
        selected ? 'font-semibold text-[#111111]' : 'font-medium text-white',
      )}
    >
      {label}
    </Text>
  </Pressable>
);

const ModelsSheetBody = ({
  models,
  cashbackRate,
  onClose,
  topPadding,
  presentation,
}: CardSheetBody & {
  models: AiApiModel[];
  cashbackRate: number;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('most_used');
  const inset = sheetBodyInset(presentation);
  const providers = useMemo(() => providersOf(models), [models]);

  const listed = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    const matching = models.filter(
      model =>
        (!provider || model.provider === provider) &&
        (!wanted ||
          model.name.toLowerCase().includes(wanted) ||
          model.id.toLowerCase().includes(wanted) ||
          (model.provider ?? '').toLowerCase().includes(wanted)),
    );
    // Models arrive most used first; a stable sort keeps that among equal prices.
    return sort === 'lowest_price'
      ? [...matching].sort((a, b) => blendedPrice(a) - blendedPrice(b))
      : matching;
  }, [models, provider, query, sort]);

  const count = models.length;

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
          {count === 1 ? 'One model' : `${count} models`} on your Solid key, priced per 1M tokens,
          and how far below the official price each one is.
        </Text>
      </View>

      <View style={{ paddingHorizontal: inset }}>
        {/* The field's own outline is off on web, so the box shows focus instead. Its
            border is always there, transparent until then, so focusing doesn't shift it. */}
        <View
          className={cn(
            'flex-row items-center gap-2.5 rounded-[14px] border bg-[#262626] px-3.5 py-3',
            searchFocused ? 'border-white/40' : 'border-transparent',
          )}
        >
          <Search size={18} color="rgba(255,255,255,0.4)" strokeWidth={AI_API_ICON_STROKE} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={count === 1 ? 'Search' : `Search ${count} models`}
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search models"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent p-0 text-[15px] text-white web:focus:outline-none"
          />
        </View>
      </View>

      {providers.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: inset, gap: 8 }}
        >
          <Chip label="All" selected={!provider} onPress={() => setProvider(null)} />
          {providers.map(model => (
            <Chip
              key={model.provider}
              label={model.provider!}
              logo={model}
              selected={provider === model.provider}
              onPress={() => setProvider(model.provider)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: inset }} className="gap-[18px]">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${SORT_LABELS[sort]}`}
            accessibilityHint="Switches between most used and lowest price"
            onPress={() =>
              setSort(current => (current === 'most_used' ? 'lowest_price' : 'most_used'))
            }
            hitSlop={8}
            className="flex-1 flex-row items-center gap-1 active:opacity-70"
          >
            <Text className="text-[13px] font-medium text-white/75">{SORT_LABELS[sort]}</Text>
            <ChevronDown
              size={14}
              color="rgba(255,255,255,0.75)"
              strokeWidth={AI_API_ICON_STROKE}
            />
          </Pressable>
          <Text className="w-[58px] text-right text-[12px] text-white/45">Input</Text>
          <Text className="w-[58px] text-right text-[12px] text-white/45">Output</Text>
        </View>

        {listed.length === 0 ? (
          <Text className="py-6 text-center text-[14px] text-white/50">No model matches.</Text>
        ) : (
          listed.map(model => (
            <View
              key={model.id}
              className="h-10 flex-row items-center gap-3"
              accessible
              accessibilityLabel={modelRowLabel(model)}
            >
              <AiApiModelLogo model={model} />
              <ModelName model={model} showDiscount />
              <Text className="w-[58px] text-right text-[14px] font-medium text-white">
                {formatAiApiTokenPrice(model.inputUsdPerMTok)}
              </Text>
              <Text className="w-[58px] text-right text-[14px] font-medium text-white">
                {formatAiApiTokenPrice(model.outputUsdPerMTok)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={{ paddingHorizontal: inset }}>
        <View className="flex-row items-start gap-2.5 rounded-[14px] bg-[rgba(148,242,127,0.1)] px-3.5 py-3">
          <Percent size={18} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
          <Text className="flex-1 text-[14px] leading-[19px] text-brand">
            You get {formatAiApiRate(cashbackRate)} back on every model.
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
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  models: AiApiModel[];
  cashbackRate: number;
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
        onClose={() => onOpenChange(false)}
      />
    )}
  </CardBottomSheet>
);
