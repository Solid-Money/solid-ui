import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageSourcePropType, Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface HowItWorksProps {
  index: number;
  title: string;
  description: string;
  image: ImageSourcePropType;
}

const HowItWorks = ({ index, title, description, image }: HowItWorksProps) => {
  return (
    <LinearGradient
      colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1 overflow-hidden rounded-twice"
      style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
    >
      <View className="p-5 md:min-h-96 md:p-6">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
          <Text className="text-xl font-bold text-primary-foreground">{index}</Text>
        </View>
        <View className="h-52 items-center justify-center">
          <Image source={image} style={{ width: 153, height: 202 }} contentFit="contain" />
        </View>
        <View className="mt-6 gap-2">
          <Text className="text-xl font-bold">{title}</Text>
          <Text className="text-lg font-medium leading-5 text-white/70">{description}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

export default HowItWorks;
