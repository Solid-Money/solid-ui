import { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { X } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { path } from '@/constants/path';
import { useAiApiOverview } from '@/hooks/useAiApi';
import { aiApiBaseUrl, aiApiSetupModel } from '@/lib/api/ai-api';
import { useAiApiRevealStore } from '@/store/useAiApiRevealStore';
import { useUserStore } from '@/store/useUserStore';

import AiApiHeader from './AiApiHeader';
import AiApiKeyReady from './AiApiKeyReady';

const leave = () => (router.canGoBack() ? router.back() : router.replace(path.AI_API));

/**
 * Figma 4/5 — the new key, shown once. Closing it is the last time the key
 * exists in readable form: the store is cleared when this screen goes, and a
 * reload (or any visit without a key just made) lands on the dashboard.
 */
export default function AiApiKeyScreen() {
  const secret = useAiApiRevealStore(state => state.secret);
  const owner = useAiApiRevealStore(state => state.userId);
  const clear = useAiApiRevealStore(state => state.clear);
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { data: overview } = useAiApiOverview();

  useEffect(() => clear, [clear]);

  // Only to the account it was made for; leaving clears it either way.
  if (!secret || !owner || owner !== userId) return <Redirect href={path.AI_API} />;

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg gap-4 pb-32 pt-6 md:py-12">
        <AiApiHeader
          title="Your API key"
          onBack={leave}
          backLabel="Close"
          backIcon={<X size={22} color="#FFFFFF" />}
        />
        <AiApiKeyReady
          secret={secret}
          baseUrl={aiApiBaseUrl(overview)}
          model={aiApiSetupModel(overview)}
          onDone={leave}
          onOpenGuide={() => router.push(path.AI_API_SETUP)}
        />
      </View>
    </PageLayout>
  );
}
