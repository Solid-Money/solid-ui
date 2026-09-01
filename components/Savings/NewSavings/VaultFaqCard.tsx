import { View } from 'react-native';

import Markdown from '@/components/Markdown';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';

/** Figma 24805:8738 / 24805:8760 — compact FAQ card for the vault detail screen. */
const VaultFaqCard = () => {
  return (
    <View className="mx-4">
      <Text className="text-[16px] font-normal leading-[16px] text-white/50">
        Frequently asked questions
      </Text>

      <View className="mt-[13px] overflow-hidden rounded-[20px] bg-[#1C1C1C] py-[5px]">
        <Accordion type="multiple" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`vault-faq-${index}`} className="border-t-0">
              <AccordionTrigger
                className="min-h-[47px] gap-[5px] px-5 py-3"
                iconClassName="text-white"
                iconSize={16}
                iconStrokeWidth={1.75}
              >
                <Text className="min-w-0 flex-1 text-[16px] font-medium leading-[23px] text-white">
                  {faq.question}
                </Text>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4 pl-[41px] md:pl-[41px]">
                <Markdown value={faq.answer} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </View>
    </View>
  );
};

export default VaultFaqCard;
