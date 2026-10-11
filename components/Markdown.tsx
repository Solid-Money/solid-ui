import { ColorValue, View } from 'react-native';
import { useMarkdown } from 'react-native-marked';

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
};

const Markdown = ({
  value,
  style = { backgroundColor: 'transparent' },
  textColor = '#A1A1A1',
}: MarkdownProps) => {
  const elements = useMarkdown(value, {
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
