import { View } from 'react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import { AGENT_INTEGRATION_CURL } from '@/constants/agentPromptTemplate';

const IntegrationSnippet = () => {
  const snippet = AGENT_INTEGRATION_CURL();
  return (
    <View className="gap-3">
      <Text className="max-w-xl text-sm text-white/60">
        Paste this curl example into a script or n8n node, or copy the AI prompt template from the
        page header to wire up Claude Desktop / ChatGPT instructions.
      </Text>
      <View className="rounded-xl bg-[#262626] p-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 break-all font-mono text-xs text-white" selectable>
            {snippet}
          </Text>
          <CopyToClipboard text={snippet} />
        </View>
      </View>
    </View>
  );
};

export default IntegrationSnippet;
