import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

import { formatAiApiRate } from './aiApiFormat';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiChip, AiApiIconTile } from './AiApiPrimitives';

/**
 * The AI API's place in "Your tier benefits": a full-width card above the
 * grid, with the green wash and "New" chip that set it apart from the tier's
 * standing perks. Every tier gets it, so it is not one of the grid's cards.
 */
const AiApiBenefitCard = ({
  cashbackRate,
  isNew,
  onPress,
}: {
  cashbackRate: number;
  /** Shown until the user has a key — it stops being news once they use it. */
  isNew: boolean;
  onPress: () => void;
}) => {
  const rate = formatAiApiRate(cashbackRate);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rate} Cashback. To run your AI agents.`}
      onPress={onPress}
      className="overflow-hidden rounded-twice border border-brand/35 bg-card transition-all active:scale-95 active:opacity-80"
    >
      <LinearGradient
        colors={['rgba(148,242,128,0.16)', 'rgba(148,242,128,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="flex-row items-center gap-3.5 px-4 py-[18px]">
        <AiApiIconTile size={48} tone="brand">
          <Bot size={24} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
        </AiApiIconTile>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[16px] font-medium text-white">{rate} Cashback</Text>
            {isNew ? <AiApiChip label="New" tone="brand" /> : null}
          </View>
          <Text className="text-[14px] leading-[19px] text-white/70">
            To run your AI agents. One API key for Claude Code, Codex and more.
          </Text>
        </View>
        <ChevronRight size={20} color="white" opacity={0.5} />
      </View>
    </Pressable>
  );
};

export default AiApiBenefitCard;
