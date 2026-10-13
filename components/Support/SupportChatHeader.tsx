import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { agentDisplayName } from '@/components/Support/MessageRow';
import SolidAiAvatar from '@/components/Support/SolidAiAvatar';
import TeammateAvatar from '@/components/Support/TeammateAvatar';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { useSupportChatStore } from '@/store/useSupportChatStore';

/**
 * The teammate on the current case: whoever last replied in it, while it is
 * open. Solid AI's own messages and system lines don't count.
 */
function useActiveTeammate(): string | null {
  const messages = useSupportChatStore(state => state.messages);
  const currentCase = useSupportChatStore(state => state.currentCase);
  return useMemo(() => {
    if (!currentCase || currentCase.status === 'resolved') return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.caseId && message.caseId !== currentCase.id) break;
      if (message.author.type === 'agent') return agentDisplayName(message.author.name);
      if (message.author.type === 'ai') return null;
    }
    return null;
  }, [currentCase, messages]);
}

/**
 * Support chat header: Solid AI's avatar (with the teammate's tucked in once
 * one joins), the name, and a live status line.
 */
function SupportChatHeader() {
  const ai = useSupportChatStore(state => state.ai);
  const teammate = useActiveTeammate();
  const status = teammate
    ? `${teammate} from the team is here`
    : (ai?.enabled ?? true)
      ? 'Solid AI · replies instantly'
      : (ai?.expectedReplyText ?? 'The Solid team replies here');

  return (
    <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
      <BackButton variant="header" fallbackHref="/" />
      <View style={{ width: 44, height: 40 }}>
        <SolidAiAvatar size={36} />
        {teammate && (
          <View
            className="absolute rounded-full bg-[#111111]"
            style={{ left: 20, top: 18, padding: 2 }}
          >
            <TeammateAvatar name={teammate} size={22} />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-white">Solid Support</Text>
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-brand" />
          <Text className="text-xs text-white/55" numberOfLines={1}>
            {status}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default memo(SupportChatHeader);
