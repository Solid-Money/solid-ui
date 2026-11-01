import { Pressable, View } from 'react-native';
import { ArrowUpRight, CircleCheck } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiCopyField, AiApiIconTile } from './AiApiPrimitives';
import AiApiSetupGuide from './AiApiSetupGuide';

/**
 * "Your key is ready": the one time the full key is shown, with the base URL
 * and the lines to paste into each agent. Leaving this screen is final — the
 * backend kept only a hash.
 */
const AiApiKeyReady = ({
  secret,
  baseUrl,
  model,
  onDone,
  onOpenGuide,
}: {
  secret: string;
  baseUrl: string;
  model: string;
  onDone: () => void;
  onOpenGuide: () => void;
}) => (
  <View className="w-full gap-5 px-4">
    <View className="items-center gap-2">
      <AiApiIconTile size={56} tone="brand">
        <CircleCheck size={28} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
      </AiApiIconTile>
      <Text className="mt-1 text-[24px] font-semibold text-white">Your key is ready</Text>
      <Text className="text-center text-[15px] leading-[21px] text-white/60">
        Copy it now. For your safety, we only show it once.
      </Text>
    </View>

    <View className="gap-3.5 rounded-twice bg-card p-4">
      <AiApiCopyField
        label="API key"
        value={secret}
        onCopied={() => track(TRACKING_EVENTS.AI_API_KEY_COPIED)}
      />
      <View className="h-px bg-white/[0.08]" />
      <AiApiCopyField label="Base URL" value={`${baseUrl}/v1`} />
    </View>

    <View className="gap-3">
      <Text className="text-[16px] font-semibold text-white">Set up your agent</Text>
      <AiApiSetupGuide baseUrl={baseUrl} apiKey={secret} model={model} />
      <Pressable
        accessibilityRole="link"
        onPress={onOpenGuide}
        className="flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <Text className="text-[14px] font-medium text-brand">Full setup guide</Text>
        <ArrowUpRight size={14} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
      </Pressable>
    </View>

    <Button variant="brand" onPress={onDone} className="mt-2 h-[52px] rounded-full">
      <Text className="text-[16px] font-bold text-black">I&apos;ve saved my key</Text>
    </Button>
  </View>
);

export default AiApiKeyReady;
