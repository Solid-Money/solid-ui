import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, Link } from 'expo-router';
import { HandCoins } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

const YELLOW = '#ffd151';

const YieldBoostBanner = () => {
  return (
    <LinearGradient
      colors={['rgba(255,209,81,0.15)', 'rgba(255,209,81,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: 16 }}
    >
      <View className="flex-row items-center gap-4 px-4 py-4 md:px-6 md:py-5">
        <View
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,209,81,0.15)' }}
        >
          <HandCoins color={YELLOW} size={22} />
        </View>

        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground">
            {'You are receiving '}
            <Text style={{ color: YELLOW }}>2%</Text>
            {' yield boost'}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-1">
            <Text className="text-sm text-primary/70">
              Your Prime tier adds 2% on top of your base savings rate.
            </Text>
            <Link href={'#' as Href} className="hover:opacity-70">
              <Text className="text-sm font-semibold text-primary/70 web:underline">
                Read more ›
              </Text>
            </Link>
          </View>
        </View>

        <Pressable
          className="shrink-0 rounded-xl px-4 py-3 active:opacity-80"
          style={{ backgroundColor: 'rgba(255,209,81,0.2)' }}
        >
          <Text className="text-sm font-semibold" style={{ color: YELLOW }}>
            Claim boosted yield
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
};

export default YieldBoostBanner;
