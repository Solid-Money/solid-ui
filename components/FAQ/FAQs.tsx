import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import FAQ from './FAQ';
import { Faq } from '@/lib/types';
import { cn } from '@/lib/utils';

type FAQsProps = {
  faqs: Faq[];
  className?: string;
};

const FAQs = ({ faqs, className }: FAQsProps) => {
  return (
    <View
      className={cn(
        'relative w-full justify-between gap-y-6 rounded-twice p-4 py-6 md:mt-8 md:flex-row md:p-10',
        className,
      )}
    >
      <View className="absolute left-0 top-0 h-full w-full border-border/50 md:border-t"></View>
      <Text className="text-center text-3xl font-semibold md:max-w-40 md:text-start">
        Frequently asked questions
      </Text>
      <FAQ faqs={faqs} className="max-w-screen-md" />
    </View>
  );
};

export default FAQs;
