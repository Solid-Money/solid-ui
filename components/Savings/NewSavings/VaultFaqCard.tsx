import { View } from 'react-native';

import Markdown from '@/components/Markdown';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { getVaultFaqs } from '@/constants/vault-faqs';
import { VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

type VaultFaqCardProps = {
  vaultType: VaultType;
  /** Defaults to "Frequently asked questions"; the How it works sheet says "Questions". */
  title?: string;
  /** Overrides the inset (outer) and the card surface (inner). */
  className?: string;
  cardClassName?: string;
};

/**
 * Figma 24805:8738 / 24805:8760 — compact FAQ card for the vault detail screen.
 *
 * The questions are vault-specific: the ETH and FUSE vaults answer for soETH
 * and soFUSE rather than reusing the soUSD list.
 */
const VaultFaqCard = ({
  vaultType,
  title = 'Frequently asked questions',
  className,
  cardClassName,
}: VaultFaqCardProps) => {
  const faqs = getVaultFaqs(vaultType);

  return (
    <View className={cn('mx-4', className)}>
      <Text className="text-[16px] font-normal leading-[16px] text-white/50">{title}</Text>

      <View
        className={cn(
          'mt-[13px] overflow-hidden rounded-[20px] bg-[#1C1C1C] py-[5px]',
          cardClassName,
        )}
      >
        <Accordion type="multiple" collapsible className="w-full">
          {faqs.map((faq, index) => (
            // Scoped to the vault so switching vaults on the same mounted
            // screen collapses the rows instead of leaving an index expanded
            // onto a different question.
            <AccordionItem
              key={faq.question}
              value={`${vaultType}-faq-${index}`}
              className="border-t-0"
            >
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
