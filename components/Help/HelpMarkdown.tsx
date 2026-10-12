import { memo, type ReactNode, useMemo } from 'react';
import { type ImageStyle, Linking, Pressable, type TextStyle, View } from 'react-native';
import { Renderer, useMarkdown } from 'react-native-marked';

import { Text } from '@/components/ui/text';
import { openHelpLink } from '@/lib/help/links';

/** In-page anchors (`#h_fees`) have nowhere to go in the app; everything else opens. */
function openLink(href: string) {
  if (!href || href.startsWith('#')) return;
  if (/^https?:\/\//i.test(href)) {
    openHelpLink(href);
    return;
  }
  if (/^(mailto|tel):/i.test(href)) Linking.openURL(href).catch(() => undefined);
}

/** Links go through the help router: another article opens in the app, not the browser. */
class HelpRenderer extends Renderer {
  link(children: string | ReactNode[], href: string, styles?: TextStyle): ReactNode {
    return (
      <Text
        key={this.getKey()}
        accessibilityRole="link"
        onPress={() => openLink(href)}
        style={styles}
      >
        {children}
      </Text>
    );
  }

  linkImage(
    href: string,
    imageUrl: string,
    alt?: string,
    style?: ImageStyle,
    title?: string,
  ): ReactNode {
    return (
      <Pressable
        key={this.getKey()}
        accessibilityRole="link"
        accessibilityLabel={alt || title || 'Link'}
        onPress={() => openLink(href)}
      >
        {this.image(imageUrl, alt, style, title)}
      </Pressable>
    );
  }
}

const STYLES = {
  text: { color: '#D4D4D4', fontSize: 16, lineHeight: 25 },
  paragraph: { marginBottom: 14, paddingVertical: 0 },
  strong: { color: '#FFFFFF', fontWeight: '600' as const },
  em: { color: '#FFFFFF', fontStyle: 'italic' as const },
  link: { color: '#94F27F', textDecorationLine: 'underline' as const },
  h1: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    marginTop: 18,
    marginBottom: 10,
  },
  h2: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    marginTop: 14,
    marginBottom: 8,
  },
  h3: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    marginTop: 12,
    marginBottom: 6,
  },
  li: { color: '#D4D4D4', fontSize: 16, lineHeight: 25 },
  list: { marginBottom: 14 },
  blockquote: {
    backgroundColor: '#1C1C1C',
    borderLeftColor: '#94F27F',
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  codespan: { backgroundColor: '#262626', color: '#FFFFFF', fontSize: 14 },
  code: { backgroundColor: '#161616', borderRadius: 10, padding: 12, marginBottom: 14 },
  hr: { backgroundColor: 'rgba(255,255,255,0.1)', height: 1, marginVertical: 18 },
  image: { borderRadius: 12, marginVertical: 8 },
  table: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
  },
  tableRow: { borderColor: 'rgba(255,255,255,0.12)' },
  tableCell: { padding: 10 },
};

/** A help article's body, in the app's dark style. */
const HelpMarkdown = memo(function HelpMarkdown({ value }: { value: string }) {
  const renderer = useMemo(() => new HelpRenderer(), []);
  const elements = useMarkdown(value, { renderer, styles: STYLES, colorScheme: 'dark' });
  return <View>{elements}</View>;
});

export default HelpMarkdown;
