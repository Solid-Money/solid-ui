import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';

import ResponsiveModalMobile from '@/components/ResponsiveModalMobile';
import useDepositOption from '@/hooks/useDepositOption';

export default function Deposit() {
  const {
    actionButton,
    getContent,
    getContentKey,
    getTitle,
    getContainerClassName,
    handleBackPress,
  } = useDepositOption();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        <View className="gap-8 md:gap-9 px-4 pt-8 pb-24 md:py-12 w-full max-w-md mx-auto">
          <ResponsiveModalMobile
            containerClassName={getContainerClassName()}
            title={getTitle()}
            showBackButton={true}
            onBackPress={handleBackPress}
            actionButton={actionButton}
            contentKey={getContentKey()}
          >
            {getContent()}
          </ResponsiveModalMobile>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
