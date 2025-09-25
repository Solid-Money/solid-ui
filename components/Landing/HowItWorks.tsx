import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface HowItWorksProps {
  index: number;
  description: string;
}

const HowItWorks = ({ index, description }: HowItWorksProps) => {
  return (
    <View className="flex-1 justify-center gap-2 md:min-h-48 bg-card rounded-twice p-5 md:p-6">
      <Text className="text-2xl md:text-4.5xl text-brand font-light">{index}.</Text>
      <Text className="text-lg leading-5 text-muted-foreground font-medium">{description}</Text>
    </View>
  );
};

export default HowItWorks;
