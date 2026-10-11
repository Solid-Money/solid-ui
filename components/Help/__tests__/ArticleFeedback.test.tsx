import React from 'react';

import { ArticleFeedback } from '@/components/Help/HelpParts';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import type { HelpArticle } from '@/lib/types/help';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockPush = jest.fn();
const mockFeedback = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (href: string) => mockPush(href) }) }));
jest.mock('@/lib/api/help', () => ({
  sendHelpFeedback: (...args: unknown[]) => mockFeedback(...args),
}));
jest.mock('@/lib/mmvkStorage', () => () => {
  const memory = new Map<string, string>();
  return {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  };
});
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/input', () => 'Input');
jest.mock('@/components/ui/back-button', () => ({ BackButton: 'BackButton' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));

const article: HelpArticle = {
  id: 'a1',
  slug: 'apple-pay',
  title: 'Apple Pay',
  description: '',
  markdown: 'text',
  audience: 'public',
  versionId: 'v1',
  versionNumber: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
  collection: null,
  parent: null,
  related: [],
  url: null,
};

const texts = (tree: any) =>
  tree.root
    .findAllByType('Text')
    .map((node: any) => [].concat(node.props.children).join(''))
    .join(' | ');

describe('ArticleFeedback', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockFeedback.mockReset();
  });

  it('asks, records a "no" for this version, and offers the chat with the article attached', async () => {
    mockFeedback.mockResolvedValue({ recorded: true });
    let tree: any;
    act(() => {
      tree = create(<ArticleFeedback article={article} />);
    });
    expect(texts(tree)).toContain('Did this answer your question?');

    const no = tree.root.find((node: any) => node.props.accessibilityLabel === 'No');
    await act(async () => {
      await no.props.onPress();
    });
    expect(mockFeedback).toHaveBeenCalledWith('a1', 'v1', false);
    expect(texts(tree)).toContain('Chat with us about this');

    const chat = tree.root.find(
      (node: any) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    );
    act(() => chat.props.onPress());
    expect(useSupportChatStore.getState().draftContext).toEqual({
      kind: 'help_article',
      id: 'apple-pay',
      label: 'Apple Pay',
    });
    expect(mockPush).toHaveBeenCalledWith('/support');
  });

  it('says so when the vote could not be sent', async () => {
    mockFeedback.mockRejectedValue(new Error('offline'));
    let tree: any;
    act(() => {
      tree = create(<ArticleFeedback article={{ ...article, versionId: 'v2' }} />);
    });
    const yes = tree.root.find((node: any) => node.props.accessibilityLabel === 'Yes');
    await act(async () => {
      await yes.props.onPress();
    });
    expect(texts(tree)).toContain("Couldn't send that. Try again?");
  });
});
