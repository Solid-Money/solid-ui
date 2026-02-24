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
};

const Markdown = ({ value, style = { backgroundColor: 'transparent' } }: MarkdownProps) => {
  const elements = useMarkdown(value, {
    styles: {
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
    },
  });

  return <View style={style}>{elements}</View>;
};

export default Markdown;
