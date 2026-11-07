import { useMemo } from 'react';
import { ColorValue, View } from 'react-native';
import { useMarkdown } from 'react-native-marked';

import { SupportMessageRenderer } from '@/components/Support/SupportMessageRenderer';

import type { SupportLinkPolicy } from '@/lib/support/messageLinks';

export type MarkdownStyle = {
  text?: ColorValue;
  strong?: ColorValue;
  em?: ColorValue;
  code?: ColorValue;
  backgroundColor?: ColorValue;
};

type MarkdownProps = {
  value: string;
  style?: MarkdownStyle;
  /** Body text colour; defaults to the muted grey used on content pages. */
  textColor?: ColorValue;
  /**
   * Text someone outside the app wrote (support replies): which links may
   * open, and no images. Unset for our own content (FAQs).
   */
  linkPolicy?: SupportLinkPolicy;
};

const Markdown = ({
  value,
  style = { backgroundColor: 'transparent' },
  textColor = '#A1A1A1',
  linkPolicy,
}: MarkdownProps) => {
  const renderer = useMemo(
    () => (linkPolicy ? new SupportMessageRenderer(linkPolicy) : undefined),
    [linkPolicy],
  );
  const elements = useMarkdown(value, {
    renderer,
    styles: {
      text: {
        color: textColor,
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
    },
  });

  return <View style={style}>{elements}</View>;
};

export default Markdown;
