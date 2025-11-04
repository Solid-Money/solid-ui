import RNMarkdown from 'react-native-marked';

type MarkdownProps = {
  value: string;
};

const Markdown = ({ value }: MarkdownProps) => {
  return (
    <RNMarkdown
      value={value}
      flatListProps={{
        initialNumToRender: 8,
        style: {
          backgroundColor: 'transparent',
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
  );
};

export default Markdown;
