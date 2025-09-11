import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { Faq } from '@/lib/types';
import { cn } from '@/lib/utils';
import Markdown from '@/components/Markdown';

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
            <Markdown value={faq.answer} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default FAQ;
