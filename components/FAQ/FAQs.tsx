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
        'md:flex-row justify-between gap-y-6 w-full md:mt-8 bg-card rounded-twice p-4 py-6 md:p-10',
        className,
      )}
    >
      <Text className="text-3xl font-semibold text-center md:text-start md:max-w-40">
        Frequently asked questions
      </Text>
      <FAQ faqs={faqs} className="max-w-screen-md" />
    </View>
  );
};

export default FAQs;
