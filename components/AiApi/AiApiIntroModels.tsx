import { type ComponentProps, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowUpRight } from 'lucide-react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

import {
  aiApiModelDiscount,
  aiApiModelIsFree,
  aiApiModelPriceExample,
  aiApiModelTag,
  formatAiApiRate,
  formatAiApiTokenPrice,
} from './aiApiFormat';
import AiApiIntroDisclosure from './AiApiIntroDisclosure';
import { getAntseedModelUrl } from './aiApiLinks';
import AiApiModelLogo from './AiApiModelLogo';
import { AI_API_ICON_STROKE, AiApiCopyPill, AiApiIntroChevron } from './AiApiPrimitives';

import type { AiApiModel } from '@/lib/types/ai-api';

const SAVING_METHOD =
  'Saving compares Solid’s price with the official API price, for 3 input tokens to every 1 output token.';
const FREE_MODEL_ELIGIBILITY = 'Free for verified accounts';

const priceText = (price: number | null) =>
  price === null ? '—' : price === 0 ? '$0.00' : formatAiApiTokenPrice(price);

const ModelPricing = ({
  model,
  cashbackRate,
  isCapped,
  isFree,
}: {
  model: AiApiModel;
  cashbackRate: number;
  isCapped: boolean;
  isFree: boolean;
}) => {
  const rows = [
    {
      label: 'Input',
      solid: model.inputUsdPerMTok,
      official: model.officialInputUsdPerMTok ?? null,
    },
    ...(model.cachedInputUsdPerMTok == null
      ? []
      : [{ label: 'Cached input', solid: model.cachedInputUsdPerMTok, official: null }]),
    {
      label: 'Output',
      solid: model.outputUsdPerMTok,
      official: model.officialOutputUsdPerMTok ?? null,
    },
  ];
  const hasOfficial = rows.some(row => row.official !== null);
  const hasCashback = !isFree && cashbackRate > 0;
  const rate = formatAiApiRate(cashbackRate);
  const afterLabel = `After ${rate} back`;

  return (
    <>
      <View className="rounded-[14px] bg-white/5 px-3 py-0.5">
        <View className="flex-row items-center gap-2 pb-2 pt-2.5">
          <Text className="flex-1 text-[12px] leading-[17px] text-white/45">Per 1M tokens</Text>
          {hasOfficial ? (
            <Text className="w-[20%] max-w-[54px] text-right text-[12px] leading-[17px] text-white/45">
              Official
            </Text>
          ) : null}
          <Text className="w-[20%] max-w-[54px] text-right text-[12px] leading-[17px] text-white/45">
            Solid
          </Text>
          {hasCashback ? (
            <Text className="w-[30%] max-w-[96px] text-right text-[12px] leading-[17px] text-white/45">
              {afterLabel}
            </Text>
          ) : null}
        </View>
        {rows.map(row => (
          <View
            key={row.label}
            className="flex-row items-center gap-2 border-t border-white/[0.06] py-[11px]"
          >
            <Text className="flex-1 text-[13px] leading-[18px] text-white/70">{row.label}</Text>
            {hasOfficial ? (
              <Text
                className={cn(
                  'w-[20%] max-w-[54px] text-right text-[13px] leading-[18px] text-white/40',
                  row.official !== null && 'line-through',
                )}
              >
                {priceText(row.official)}
              </Text>
            ) : null}
            <Text
              className={cn(
                'w-[20%] max-w-[54px] text-right text-[13px] font-semibold leading-[18px]',
                isFree ? 'text-brand' : 'text-white',
              )}
            >
              {isFree ? 'Free' : priceText(row.solid)}
            </Text>
            {hasCashback ? (
              <Text className="w-[30%] max-w-[96px] text-right text-[13px] font-semibold leading-[18px] text-brand">
                {priceText(row.solid * (1 - cashbackRate))}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {isFree ? (
        <FreeModelInfo />
      ) : (
        <ModelCashbackExample model={model} cashbackRate={cashbackRate} isCapped={isCapped} />
      )}
    </>
  );
};

const FreeModelInfo = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="gap-1.5 rounded-[14px] bg-brand/10 p-3">
      <Text className="text-[14px] font-semibold leading-5 text-white">
        {FREE_MODEL_ELIGIBILITY}
      </Text>
      <Text className="text-[13px] leading-[18px] text-white/60">
        No charge, so no cashback. Each account has a daily limit on free requests.
      </Text>
      <Pressable
        accessibilityRole="button"
        aria-expanded={expanded}
        onPress={() => setExpanded(open => !open)}
        hitSlop={4}
        className="flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <Text className="text-[14px] font-medium leading-5 text-white">Why is it free?</Text>
        <ArrowUpRight size={14} color="white" strokeWidth={AI_API_ICON_STROKE} />
      </Pressable>
      {expanded ? (
        <Text className="text-[13px] leading-[18px] text-white/60">
          Solid sets the prices for models on Antseed and makes this one available at no cost within
          the daily request limit.
        </Text>
      ) : null}
    </View>
  );
};

const ModelCashbackExample = ({
  model,
  cashbackRate,
  isCapped,
}: {
  model: AiApiModel;
  cashbackRate: number;
  isCapped: boolean;
}) => {
  const example = aiApiModelPriceExample(model, cashbackRate);
  const hasCashback = cashbackRate > 0;
  const rate = formatAiApiRate(cashbackRate);

  return (
    <View className="gap-2.5 rounded-[14px] bg-brand/10 p-3">
      <Text className="text-[12px] leading-[17px] text-white/55">
        On 1M tokens (3 input to 1 output)
      </Text>
      <View className="flex-row gap-2">
        {example.official !== null ? (
          <ModelExampleAmount
            label="Official"
            value={example.official}
            className="text-white/50 line-through"
          />
        ) : null}
        <ModelExampleAmount label="You pay" value={example.solid} />
        {hasCashback ? (
          <ModelExampleAmount
            label={`After ${rate} back`}
            value={example.afterCashback}
            className="text-brand"
          />
        ) : null}
      </View>
      {hasCashback && example.savingsAfterCashback !== null ? (
        <Text className="text-[13px] font-medium leading-[18px] text-brand">
          {example.savingsAfterCashback}% less than the official price
        </Text>
      ) : null}
      {hasCashback && isCapped ? (
        <Text className="text-[12px] leading-[17px] text-white/45">
          {rate} back applies up to your tier’s monthly cap.
        </Text>
      ) : null}
    </View>
  );
};

const ModelExampleAmount = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) => (
  <View className="flex-1 justify-between gap-0.5">
    <Text className="text-[12px] leading-[17px] text-white/55">{label}</Text>
    <Text className={cn('text-[17px] font-semibold leading-6 text-white', className)}>
      {priceText(value)}
    </Text>
  </View>
);

const ModelRow = ({
  model,
  cashbackRate,
  isCapped,
  expanded,
  onToggle,
}: {
  model: AiApiModel;
  cashbackRate: number;
  isCapped: boolean;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const tag = aiApiModelTag(model);
  const isFree = aiApiModelIsFree(model);
  const summary = isFree
    ? FREE_MODEL_ELIGIBILITY
    : `${priceText(model.inputUsdPerMTok)} in · ${priceText(model.outputUsdPerMTok)} out`;

  return (
    <View className="border-b border-white/[0.07] px-4 py-3.5">
      <Pressable accessibilityRole="button" aria-expanded={expanded} onPress={onToggle}>
        <View className="flex-row items-center gap-3">
          <AiApiModelLogo model={model} />
          <View className="flex-1 gap-px">
            <Text className="text-[15px] font-medium leading-[21px] text-white">{model.name}</Text>
            {model.provider ? (
              <Text className="text-[13px] leading-[18px] text-white/50">by {model.provider}</Text>
            ) : null}
          </View>
          {tag ? (
            <View className="rounded-full bg-brand/[0.14] px-2.5 py-[5px]">
              <Text className="text-[14px] font-semibold leading-5 text-brand">{tag}</Text>
            </View>
          ) : null}
          <AiApiIntroChevron expanded={expanded} />
        </View>
        <AiApiIntroDisclosure expanded={!expanded}>
          <Text className="pl-11 pt-2 text-[13px] font-medium leading-[18px] text-white/85">
            {summary}
          </Text>
        </AiApiIntroDisclosure>
      </Pressable>

      <AiApiIntroDisclosure expanded={expanded}>
        <View className="gap-2.5 pt-3.5">
          <ModelPricing
            model={model}
            cashbackRate={cashbackRate}
            isCapped={isCapped}
            isFree={isFree}
          />
          <View className="rounded-[14px] bg-white/5 px-3">
            {model.provider ? <ModelSpec label="Made by" value={model.provider} /> : null}
            <View className={model.provider ? 'border-t border-white/[0.06]' : undefined}>
              <ModelSpec
                label="Served by"
                value="Antseed providers"
                href={getAntseedModelUrl(model)}
              />
            </View>
          </View>
          <View className="flex-row items-center gap-3 rounded-[14px] bg-white/5 py-3 pl-3.5 pr-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-[12px] leading-[17px] text-white/55">
                Model ID for your agent
              </Text>
              <Text className="!font-mono text-[14px] leading-5 text-white" selectable>
                {model.id}
              </Text>
            </View>
            <AiApiCopyPill text={model.id} accessibilityLabel={`Copy ${model.name} model ID`} />
          </View>
        </View>
      </AiApiIntroDisclosure>
    </View>
  );
};

const ModelSpec = ({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: ComponentProps<typeof ExternalLink>['href'];
}) => {
  const valueClass = 'shrink text-right text-[13px] font-medium leading-[18px] text-white';
  return (
    <View className="flex-row items-center justify-between gap-2 py-[11px]">
      <Text className="text-[13px] leading-[18px] text-white/55">{label}</Text>
      {href ? (
        <ExternalLink
          href={href}
          rel="noopener noreferrer"
          className={cn(valueClass, '-my-2 py-2 underline active:opacity-70')}
        >
          {value}
        </ExternalLink>
      ) : (
        <Text className={valueClass}>{value}</Text>
      )}
    </View>
  );
};

const AiApiIntroModels = ({
  models,
  cashbackRate,
  isCapped,
}: {
  models: AiApiModel[];
  cashbackRate: number;
  isCapped: boolean;
}) => {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showSavingMethod, setShowSavingMethod] = useState(false);
  const hasSavings = models.some(
    model => !aiApiModelIsFree(model) && aiApiModelDiscount(model) !== null,
  );
  if (models.length === 0) return null;

  return (
    <View className="gap-1 rounded-twice bg-card px-4 pb-4 pt-[18px]">
      <View className="flex-row items-end gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-semibold leading-[22px] text-white">Models</Text>
          <Text className="text-[13px] leading-[18px] text-white/50">
            {models.length} {models.length === 1 ? 'model' : 'models'} on one API key · per 1M
            tokens
          </Text>
        </View>
        {hasSavings ? (
          <Pressable
            accessibilityLabel="How saving is calculated"
            accessibilityRole="button"
            aria-expanded={showSavingMethod}
            onPress={() => setShowSavingMethod(open => !open)}
            className="mr-7 flex-row items-center gap-1 active:opacity-70"
            hitSlop={8}
          >
            <Text className="text-[13px] leading-[18px] text-white/50">Saving</Text>
            <Image
              source={getAsset('images/ai-api/saving-help.svg')}
              style={{ width: 14, height: 14, opacity: 0.5 }}
            />
          </Pressable>
        ) : null}
      </View>
      {hasSavings && showSavingMethod ? (
        <Text className="rounded-[14px] bg-white/5 px-3 py-2 text-[13px] leading-[18px] text-white/70">
          {SAVING_METHOD}
        </Text>
      ) : null}
      <View className="-mx-4">
        {models.map(model => (
          <ModelRow
            key={model.id}
            model={model}
            cashbackRate={cashbackRate}
            isCapped={isCapped}
            expanded={expandedModel === model.id}
            onToggle={() => setExpandedModel(current => (current === model.id ? null : model.id))}
          />
        ))}
      </View>
      <Text className="pt-2.5 text-[12px] leading-[17px] text-white/40">
        {hasSavings ? `${SAVING_METHOD} ` : ''}
        Prices are set by Solid and can change.
        {cashbackRate > 0
          ? ` ${formatAiApiRate(cashbackRate)} of what you pay comes back as cashback.`
          : ''}
      </Text>
    </View>
  );
};

export default AiApiIntroModels;
