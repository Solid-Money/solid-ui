import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AGENT_INTEGRATION_CURL, AGENT_PROMPT_TEMPLATE } from '@/constants/agentPromptTemplate';

const handleCopyPrompt = async () => {
  await Clipboard.setStringAsync(AGENT_PROMPT_TEMPLATE);
  Toast.show({
    type: 'success',
    text1: 'Prompt template copied',
    text2: 'Paste into Claude Desktop or ChatGPT instructions',
    props: { badgeText: 'Copied' },
  });
};

const IntegrationSnippet = () => {
  const snippet = AGENT_INTEGRATION_CURL();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Use these to wire up your AI tool. Paste the prompt template into Claude Desktop or ChatGPT
        custom GPTs, and the curl example into a script or n8n node.
      </Text>
      <View className="rounded-xl bg-[#262626] p-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 break-all font-mono text-xs text-white" selectable>
            {snippet}
          </Text>
          <CopyToClipboard text={snippet} />
        </View>
      </View>
      <Button variant="secondary" onPress={handleCopyPrompt}>
        <Text>Copy AI prompt template</Text>
      </Button>
    </View>
  );
};

export default IntegrationSnippet;
