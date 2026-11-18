import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Terminal } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useWebHorizontalScroll } from '@/hooks/useWebHorizontalScroll';
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
  models,
  initialAgent = 'claude-code',
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Every model the key can call, for agents whose config lists them. */
  models: { id: string; name: string }[];
  initialAgent?: AiApiAgent;
}) => {
  const [agent, setAgent] = useState<AiApiAgent>(initialAgent);
  const guide = buildAiApiSetupGuide({ agent, baseUrl, apiKey, model, models });

  const tabsRef = useRef<ScrollView>(null);
  const tabsWidth = useRef(0);
  const tabsContentWidth = useRef(0);
  const tabFrames = useRef<Partial<Record<AiApiAgent, { x: number; width: number }>>>({});
  useWebHorizontalScroll(tabsRef);

  const selectTab = (id: AiApiAgent) => {
    setAgent(id);
    // Bring a tab the row has cut off to the middle, so the user sees what
    // they picked and the tabs on either side of it. Held to the row's ends:
    // iOS would otherwise scroll past them.
    const frame = tabFrames.current[id];
    const maxX = tabsContentWidth.current - tabsWidth.current;
    if (!frame || tabsWidth.current === 0 || maxX <= 0) return;
    tabsRef.current?.scrollTo({
      x: Math.min(maxX, Math.max(0, frame.x + frame.width / 2 - tabsWidth.current / 2)),
      animated: true,
    });
  };

  return (
    <View className="w-full gap-3">
      {/* Figma's tabs at full size, scrolling sideways once they outgrow the
          row (five do on a phone), rather than shrinking every name to fit.
          Where they fit, they stretch to fill it. */}
      <ScrollView
        ref={tabsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={event => {
          tabsWidth.current = event.nativeEvent.layout.width;
        }}
        onContentSizeChange={width => {
          tabsContentWidth.current = width;
        }}
        className="w-full flex-grow-0 rounded-full bg-card"
        contentContainerStyle={{ padding: 4, flexGrow: 1 }}
        accessibilityRole="tablist"
      >
        {AI_API_AGENT_TABS.map(tab => {
          const selected = tab.id === agent;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => selectTab(tab.id)}
              onLayout={event => {
                const { x, width } = event.nativeEvent.layout;
                tabFrames.current[tab.id] = { x, width };
              }}
              className={cn(
                'flex-grow items-center justify-center rounded-full px-3.5 py-[9px]',
                selected ? 'bg-white' : 'active:opacity-70',
              )}
            >
              <Text
                numberOfLines={1}
                className="text-[14px]"
                style={selected ? SELECTED_TAB_LABEL : TAB_LABEL}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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

/**
 * A tab label's colour and weight, kept out of its classes. On the web a
 * Text's classes pile up across renders instead of being replaced, so toggling
 * `text-black` / `text-white/70` left the newly picked tab white on white; and
 * a `StyleSheet.create` style becomes an atomic class that loses to the Text's
 * own `text-foreground` (see upgradeRouteLabel.ts). A plain object stays an
 * inline style, which wins on the web, as the `style` prop does on native.
 */
const TAB_LABEL = { color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'MonaSans_500Medium' };
const SELECTED_TAB_LABEL = { color: '#000000', fontFamily: 'MonaSans_600SemiBold' };

export default AiApiSetupGuide;
