import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

/**
 * The merged green "glass" VISA card shown on the wallet page. Tapping it opens
 * the full card management page (/card/details).
 *
 * PLACEHOLDER assets: there is no VISA/"Platinum" brand mark or dedicated card
 * artwork in assets/images, so the wordmark is rendered as text and the menu
 * glyph uses lucide MoreHorizontal. Swap these for real assets when available.
 */
const HomeWalletCard = () => {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push(path.CARD_DETAILS)}>
      <LinearGradient
        // Brand-green gradient lifted from SpendingBalanceCard in card/details.tsx.
        colors={['rgba(104,216,82,1)', 'rgba(104,216,82,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 200, borderRadius: 20, overflow: 'hidden' }}
      >
        <View className="flex-1 justify-end p-5">
          <View className="flex-row items-end justify-between">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-black/20">
              <MoreHorizontal size={22} color="#ffffff" />
            </View>
            <View className="items-end">
              <Text className="text-2xl font-bold italic text-white">VISA</Text>
              <Text className="text-xs font-medium text-white/80">Platinum</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export default HomeWalletCard;
