import Markdown from 'react-native-marked';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { Faq } from '@/lib/types';

const FAQ = ({ faqs }: { faqs: Faq[] }) => {
  return (
    <Accordion type="multiple" collapsible defaultValue={['item-1']} className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index + 1}`}>
          <AccordionTrigger>
            <Text className="text-lg font-medium">{faq.question}</Text>
          </AccordionTrigger>
          <AccordionContent>
            <Markdown
              value={faq.answer}
              flatListProps={{
                initialNumToRender: 8,
              }}
              styles={{
                text: {
                  color: '#A1A1A1',
                },
              }}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default FAQ;
