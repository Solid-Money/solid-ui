import { View } from 'react-native';
import { router } from 'expo-router';
import { Cpu } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useAiApiOverview } from '@/hooks/useAiApi';
import { aiApiBaseUrl, aiApiSetupModel } from '@/lib/api/ai-api';

import AiApiHeader from './AiApiHeader';
import {
  AI_API_ICON_STROKE,
  AiApiCopyField,
  AiApiCopyPill,
  AiApiDivider,
  AiApiGroup,
  AiApiIconTile,
} from './AiApiPrimitives';
import AiApiSetupGuide from './AiApiSetupGuide';
import { AI_API_KEY_PLACEHOLDER } from './aiApiSnippets';

/**
 * The setup guide, any time after the key was made. The key itself is never
 * shown again, so the lines carry a placeholder for the one the user saved.
 */
export default function AiApiSetupScreen() {
  const { data: overview } = useAiApiOverview();
  const baseUrl = aiApiBaseUrl(overview);
  const models = overview?.models ?? [];

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg gap-4 pb-32 pt-6 md:py-12">
        <AiApiHeader title="Setup guide" />
        <View className="w-full gap-5 px-4">
          <Text className="text-[15px] leading-[21px] text-white/60">
            Point your agent at Solid and paste in the key you saved. We only showed it once — if
            it’s lost, make a new key and delete the old one.
          </Text>

          <View className="gap-3.5 rounded-twice bg-card p-4">
            <AiApiCopyField label="Base URL" value={`${baseUrl}/v1`} />
          </View>

          <AiApiSetupGuide
            baseUrl={baseUrl}
            apiKey={AI_API_KEY_PLACEHOLDER}
            model={aiApiSetupModel(overview)}
          />

          {models.length > 0 ? (
            <View className="gap-3">
              <Text className="text-[16px] font-semibold text-white">Models you can use</Text>
              <AiApiGroup>
                {models.map((model, index) => (
                  <View key={model.id}>
                    {index > 0 ? <AiApiDivider /> : null}
                    <View className="min-h-[60px] flex-row items-center gap-3 px-4 py-3">
                      <AiApiIconTile>
                        <Cpu size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />
                      </AiApiIconTile>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-[16px] font-semibold text-white" numberOfLines={1}>
                          {model.name}
                        </Text>
                        <Text
                          className="font-mono text-[13px] text-[#ACACAC]"
                          numberOfLines={1}
                          selectable
                        >
                          {model.id}
                        </Text>
                      </View>
                      <AiApiCopyPill
                        text={model.id}
                        compact
                        accessibilityLabel={`Copy ${model.name} model name`}
                      />
                    </View>
                  </View>
                ))}
              </AiApiGroup>
            </View>
          ) : null}

          <Button
            variant="secondary"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(path.AI_API))}
            className="mt-2 h-[52px] rounded-full"
          >
            <Text className="text-[16px] font-bold text-white">Done</Text>
          </Button>
        </View>
      </View>
    </PageLayout>
  );
}
