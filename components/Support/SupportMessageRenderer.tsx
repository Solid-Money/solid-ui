import { Renderer } from 'react-native-marked';

import { canOpenSupportLink, type SupportLinkPolicy } from '@/lib/support/messageLinks';

import type { ReactNode } from 'react';
import type { TextStyle } from 'react-native';

/**
 * Markdown for support replies: a link opens only if its author may link
 * there (see canOpenSupportLink); any other link stays as plain words. No
 * pictures: a reply's files come as attachments, and an image in the text
 * would load from wherever its URL points the moment the chat opens.
 */
export class SupportMessageRenderer extends Renderer {
  constructor(private readonly policy: SupportLinkPolicy) {
    super();
  }

  link(
    children: string | ReactNode[],
    href: string,
    styles?: TextStyle,
    title?: string,
  ): ReactNode {
    if (canOpenSupportLink(href, this.policy)) return super.link(children, href, styles, title);
    // The paragraph's own style, not the link colour: it should not look tappable.
    return this.text(children);
  }

  image(): ReactNode {
    return null;
  }

  linkImage(): ReactNode {
    return null;
  }
}
