import Markdown from 'react-native-marked';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { Faq } from '@/lib/types';
import { cn } from '@/lib/utils';

type FAQProps = {
  faqs: Faq[];
  className?: string;
};

const FAQ = ({ faqs, className }: FAQProps) => {
  return (
    <Accordion
      type="multiple"
      collapsible
      defaultValue={['item-1']}
      className={cn('w-full', className)}
    >
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
                style: {
                  backgroundColor: '#212121',
                },
              }}
              styles={{
                text: {
                  color: '#A1A1A1',
                },
                strong: {
                  color: '#ffffff',
                },
                em: {
                  color: '#ffffff',
                },
                code: {
                  backgroundColor: '#161b22',
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
