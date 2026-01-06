import { View } from 'react-native';

import PageLayout from '@/components/PageLayout';

type CardWaitlistHeaderProps = {
  children: React.ReactNode;
  content: React.ReactNode;
};

const CardWaitlistHeader = ({ children, content }: CardWaitlistHeaderProps) => {
  return (
    <PageLayout>
      <View className="mx-auto w-full max-w-7xl gap-8 px-4 pb-24 pt-6 md:gap-9 md:py-12">
        {content}
        {children}
      </View>
    </PageLayout>
  );
};

export default CardWaitlistHeader;
