import { ColorValue } from 'react-native';
import RNMarkdown from 'react-native-marked';

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
  return (
    <RNMarkdown
      value={value}
      flatListProps={{
        initialNumToRender: 8,
        style,
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
  );
};

export default Markdown;
