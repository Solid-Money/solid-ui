import type { AiApiModel } from '@/lib/types/ai-api';

export const ANTSEED_DOCS_URL = 'https://antseed.com/docs/overview/';

const ANTSEED_STATS_ORIGIN = 'https://antseedstats.com';

// AntSeedStats uses canonical slugs that can differ from the IDs Solid accepts.
const antseedModelSlugs = new Map([
  ['claude-opus-5-5', 'claude-opus-5-5'],
  ['claude-sonnet-5-5', 'claude-sonnet-5-5'],
  ['deepseek-v4-1-flash', 'deepseek-v4-1-flash'],
  ['deepseek-v41-flash', 'deepseek-v4-1-flash'],
  ['glm-5-3', 'z-ai-glm-5-3'],
  ['gpt-6-1-sol', 'openai-gpt-61-sol'],
  ['kimi-k3', 'kimi-k3'],
  ['openai-gpt-61-sol', 'openai-gpt-61-sol'],
  ['z-ai-glm-5-3', 'z-ai-glm-5-3'],
]);

const modelKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, '-');

export const getAntseedModelUrl = (model: Pick<AiApiModel, 'id' | 'name'>): `https://${string}` => {
  const id = model.id.slice(model.id.lastIndexOf('/') + 1);
  const slug = antseedModelSlugs.get(modelKey(id)) ?? antseedModelSlugs.get(modelKey(model.name));
  return slug
    ? `${ANTSEED_STATS_ORIGIN}/models/${slug}`
    : `${ANTSEED_STATS_ORIGIN}/network?q=${encodeURIComponent(model.name.trim() || id)}`;
};
