import { View } from 'react-native';
import Toast from 'react-native-toast-message';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  AGENT_INTEGRATION_CURL,
  AGENT_PROMPT_TEMPLATE,
} from '@/constants/agentPromptTemplate';

const IntegrationSnippet = () => {
  const snippet = AGENT_INTEGRATION_CURL();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Use these to wire up your AI tool. Paste the prompt template into Claude Desktop or
        ChatGPT custom GPTs, and the curl example into a script or n8n node.
      </Text>
      <View className="rounded-twice border border-border bg-background p-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 break-all font-mono text-xs" selectable>
            {snippet}
          </Text>
          <CopyToClipboard text={snippet} />
        </View>
      </View>
      <Button
        variant="secondary"
        onPress={async () => {
          // Copy the prompt template via the same Clipboard API used elsewhere
          // (kept inline to avoid a dedicated wrapper).
          const Clipboard = await import('expo-clipboard');
          await Clipboard.setStringAsync(AGENT_PROMPT_TEMPLATE);
          Toast.show({
            type: 'success',
            text1: 'Prompt template copied',
            text2: 'Paste into Claude Desktop or ChatGPT instructions',
            props: { badgeText: 'Copied' },
          });
        }}
      >
        <Text>Copy AI prompt template</Text>
      </Button>
    </View>
  );
};

export default IntegrationSnippet;
