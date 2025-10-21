import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import { useDimension } from '@/hooks/useDimension';

type CardWaitlistHeaderProps = {
  children: React.ReactNode;
  content: React.ReactNode;
};

const CardWaitlistHeader = ({ children, content }: CardWaitlistHeaderProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}
        <View className="gap-8 md:gap-9 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
          {content}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CardWaitlistHeader;
