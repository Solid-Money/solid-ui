import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      className="flex-1 bg-background text-foreground"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        <View className="mx-auto w-full max-w-md gap-8 px-4 pb-24 pt-6 md:gap-9 md:py-12">
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
