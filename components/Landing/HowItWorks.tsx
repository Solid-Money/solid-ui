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
      className="flex-1 rounded-twice overflow-hidden"
      style={Platform.OS === 'web' ? {} : { borderRadius: 20 }}
    >
      <View className="md:min-h-96 p-5 md:p-6">
        <View className="w-10 h-10 bg-white/70 rounded-full items-center justify-center">
          <Text className="text-xl text-primary-foreground font-bold">{index}</Text>
        </View>
        <View className="items-center justify-center h-52">
          <Image source={image} style={{ width: 153, height: 202 }} contentFit="contain" />
        </View>
        <View className="gap-2 mt-6">
          <Text className="text-xl font-bold">{title}</Text>
          <Text className="text-lg leading-5 text-white/70 font-medium">{description}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

export default HowItWorks;
