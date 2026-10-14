import React from 'react';

import HelpArticleScreen from '@/app/(protected)/help/articles/[slug]';

import type { HelpArticle } from '@/lib/types/help';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockArticle: HelpArticle;
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ slug: 'article' }),
}));
jest.mock('@/hooks/useHelp', () => ({
  useHelpArticle: () => ({ data: mockArticle, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isScreenMedium: false }) }));
jest.mock('@/lib/api/help', () => ({ isHelpRedirect: () => false }));
jest.mock('@/components/PageLayout', () => ({ __esModule: true, default: 'PageLayout' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Help/HelpMarkdown', () => ({ __esModule: true, default: 'HelpMarkdown' }));
jest.mock('@/components/Help/HelpParts', () => ({
  ArticleFeedback: () => null,
  ArticleList: () => null,
  ChatCta: () => null,
  HelpHeader: () => null,
  SectionTitle: 'SectionTitle',
}));

it.each([undefined, null, '', 'invalid-date', '2026-10-01T00:00:00Z'])(
  'keeps article content readable with updatedAt=%s',
  async updatedAt => {
    mockArticle = {
      title: 'Help article',
      markdown: 'Article contents',
      updatedAt,
      related: [],
    } as unknown as HelpArticle;
    let tree: any;
    await act(async () => {
      tree = create(<HelpArticleScreen />);
    });
    expect(tree.root.findByType('HelpMarkdown').props.value).toBe('Article contents');
    const text = tree.root
      .findAllByType('Text')
      .map((node: any) => node.props.children)
      .flat()
      .join(' ');
    expect(text.includes('Updated')).toBe(updatedAt === '2026-10-01T00:00:00Z');
    if (updatedAt) {
      if (updatedAt !== 'invalid-date') expect(text).toContain('October 1, 2026');
    }
    act(() => tree.unmount());
  },
);
