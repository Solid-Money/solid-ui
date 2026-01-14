import Markdown, { MarkdownStyle } from '@/components/Markdown';
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
  markdownStyle?: MarkdownStyle;
};

const FAQ = ({ faqs, className, markdownStyle }: FAQProps) => {
  return (
    <Accordion type="multiple" collapsible className={cn('w-full', className)}>
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index + 1}`}>
          <AccordionTrigger>
            <Text className="text-lg font-medium">{faq.question}</Text>
          </AccordionTrigger>
          <AccordionContent>
            <Markdown value={faq.answer} style={markdownStyle} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default FAQ;
