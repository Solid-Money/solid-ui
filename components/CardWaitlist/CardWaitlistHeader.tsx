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
      className="flex-1 bg-background text-foreground"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}
        <View className="mx-auto w-full max-w-7xl gap-8 px-4 pb-24 pt-8 md:gap-9 md:py-12">
          {content}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CardWaitlistHeader;
