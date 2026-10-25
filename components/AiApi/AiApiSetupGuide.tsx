import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Terminal } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import { AI_API_ICON_STROKE, AiApiCodeBlock } from './AiApiPrimitives';
import { AI_API_AGENT_TABS, type AiApiAgent, buildAiApiSetupGuide } from './aiApiSnippets';

/**
 * "Set up your agent": a tab per agent and the exact lines to paste.
 *
 * Given the real key on the key-ready screen, so what is copied works as-is;
 * given a placeholder in the guide reached later, since the key is never shown
 * again.
 */
const AiApiSetupGuide = ({
  baseUrl,
  apiKey,
  model,
  initialAgent = 'claude-code',
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  initialAgent?: AiApiAgent;
}) => {
  const [agent, setAgent] = useState<AiApiAgent>(initialAgent);
  const guide = buildAiApiSetupGuide({ agent, baseUrl, apiKey, model });

  return (
    <View className="w-full gap-3">
      <View className="flex-row rounded-full bg-card p-1" accessibilityRole="tablist">
        {AI_API_AGENT_TABS.map(tab => {
          const selected = tab.id === agent;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setAgent(tab.id)}
              className={cn(
                'flex-1 items-center justify-center rounded-full py-[9px]',
                selected ? 'bg-white' : 'active:opacity-70',
              )}
            >
              <Text
                numberOfLines={1}
                className={cn(
                  'text-[14px]',
                  selected ? 'font-semibold text-black' : 'font-medium text-white/70',
                )}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {guide.blocks.map(block => (
        <AiApiCodeBlock
          key={`${agent}-${block.label}`}
          label={block.label}
          icon={
            <Terminal size={14} color="rgba(255,255,255,0.5)" strokeWidth={AI_API_ICON_STROKE} />
          }
          display={block.display}
          copy={block.copy}
          onCopied={() =>
            track(TRACKING_EVENTS.AI_API_SETUP_SNIPPET_COPIED, { agent, block: block.label })
          }
        />
      ))}

      <Text className="text-[13px] leading-[18px] text-white/50">{guide.hint}</Text>
    </View>
  );
};

export default AiApiSetupGuide;
