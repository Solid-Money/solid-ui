import React from 'react';

import MessageRow, {
  agentDisplayName,
  buildRows,
  markChatClosed,
  markChatOpened,
} from '@/components/Support/MessageRow';
import { message } from '@/lib/support/__tests__/fixtures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockRetry = jest.fn();
jest.mock('@/lib/support/sync', () => ({
  retryMessage: (id: string) => mockRetry(id),
  discardMessage: jest.fn(),
  attachmentUrl: jest.fn(),
  isLinkFresh: () => true,
  refreshMessage: jest.fn(),
}));
jest.mock('@/components/Markdown', () => 'Markdown');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// The real helpers module pulls in wagmi, which jest cannot parse; the class joiner is all these components use.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/Support/SolidAiAvatar', () => 'SolidAiAvatar');
jest.mock('@/components/Support/TeammateAvatar', () => 'TeammateAvatar');
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const chain: Record<string, unknown> = {};
  chain.duration = () => chain;
  chain.springify = () => chain;
  chain.damping = () => chain;
  return { __esModule: true, default: { View }, FadeInDown: chain };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));

const texts = (tree: any) =>
  tree.root
    .findAllByType('Text')
    .map((node: any) => [].concat(node.props.children).join(''))
    .join(' | ');

describe('buildRows', () => {
  it('puts a day label before each day and groups runs by the same author', () => {
    const rows = buildRows(
      [
        message({
          createdAt: '2026-10-01T09:00:00.000Z',
          author: { type: 'ai', name: 'Solid AI' },
        }),
        message({
          createdAt: '2026-10-01T09:01:00.000Z',
          author: { type: 'ai', name: 'Solid AI' },
        }),
        message({ createdAt: '2026-10-02T09:00:00.000Z', author: { type: 'agent', name: 'Dana' } }),
      ],
      [],
    );
    expect(rows.map(row => row.type)).toEqual(['day', 'message', 'message', 'day', 'message']);
    expect(rows[1]).toMatchObject({ first: true, last: false });
    expect(rows[2]).toMatchObject({ first: false, last: true });
    expect(rows[4]).toMatchObject({ first: true, last: true });
  });

  it('puts pending sends last', () => {
    const rows = buildRows(
      [message()],
      [
        {
          clientMessageId: 'p1',
          body: 'hi',
          uploadIds: [],
          attachmentNames: [],
          context: null,
          createdAt: '2026-10-01T00:00:00.000Z',
          status: 'sending',
        },
      ],
    );
    expect(rows.at(-1)).toMatchObject({ type: 'pending', key: 'pending-p1' });
  });
});

describe('MessageRow', () => {
  const render = (row: any) => {
    let tree: any;
    act(() => {
      tree = create(<MessageRow row={row} />);
    });
    return tree;
  };

  it('labels Solid AI and renders its reply as markdown', () => {
    const tree = render({
      type: 'message',
      key: 'a',
      message: message({ body: '**Hi**' }),
      first: true,
      last: true,
    });
    expect(texts(tree)).toContain('Solid AI');
    expect(tree.root.findByType('Markdown').props.value).toBe('**Hi**');
  });

  it('lists the help articles a Solid AI answer was based on, and opens them in the app', () => {
    const tree = render({
      type: 'message',
      key: 's',
      message: message({
        body: 'Open Wallet and add the card.',
        sources: [
          { articleId: 'a1', versionId: 'v1', title: 'Apple Pay', slug: 'apple-pay' },
          { articleId: 'a2', versionId: 'v2', title: null, slug: null },
        ],
      }),
      first: true,
      last: true,
    });
    expect(texts(tree)).toContain('Sources');
    expect(texts(tree)).toContain('Apple Pay');
    const links = tree.root.findAll(
      (node: any) => node.props.accessibilityRole === 'link' && node.props.onPress,
    );
    act(() => links[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/help/articles/apple-pay');
  });

  it('puts Solid AI or the teammate beside the last bubble of their run only', () => {
    const last = render({ type: 'message', key: 'x', message: message(), first: true, last: true });
    expect(last.root.findAllByType('SolidAiAvatar')).toHaveLength(1);
    const middle = render({
      type: 'message',
      key: 'y',
      message: message(),
      first: true,
      last: false,
    });
    expect(middle.root.findAllByType('SolidAiAvatar')).toHaveLength(0);
    const agent = render({
      type: 'message',
      key: 'z',
      message: message({ author: { type: 'agent', name: 'dana smith' } }),
      first: true,
      last: true,
    });
    expect(agent.root.findByType('TeammateAvatar').props.name).toBe('Dana');
  });

  it('animates only messages that arrive after the chat opened, once', () => {
    const entering = (tree: any) =>
      tree.root.findAll((node: any) => 'entering' in node.props)[0]?.props.entering;
    markChatOpened(['old'], Date.parse('2026-10-13T10:00:00.000Z'));
    const old = render({
      type: 'message',
      key: 'old',
      message: message({ id: 'old', createdAt: '2026-10-13T10:00:30.000Z' }),
      first: true,
      last: true,
    });
    expect(entering(old)).toBeUndefined();
    const fresh = render({
      type: 'message',
      key: 'new',
      message: message({ id: 'new', createdAt: '2026-10-13T10:00:30.000Z' }),
      first: true,
      last: true,
    });
    expect(entering(fresh)).toBeDefined();
    // Rendered again (scrolled back into view): no second animation.
    const again = render({
      type: 'message',
      key: 'new',
      message: message({ id: 'new', createdAt: '2026-10-13T10:00:30.000Z' }),
      first: true,
      last: true,
    });
    expect(entering(again)).toBeUndefined();
    markChatClosed();
  });

  it('names an agent and never renders a user message as markdown', () => {
    const agent = render({
      type: 'message',
      key: 'b',
      message: message({ author: { type: 'agent', name: 'Dana' } }),
      first: true,
      last: true,
    });
    expect(texts(agent)).toContain('Dana · Solid team');

    const user = render({
      type: 'message',
      key: 'c',
      message: message({ body: '**not bold**', author: { type: 'user', name: null } }),
      first: true,
      last: true,
    });
    expect(user.root.findAllByType('Markdown')).toHaveLength(0);
    expect(texts(user)).toContain('**not bold**');
  });

  it('shows a removed message without its text', () => {
    const tree = render({
      type: 'message',
      key: 'd',
      message: message({ body: null, redacted: true, author: { type: 'user', name: null } }),
      first: true,
      last: true,
    });
    expect(texts(tree)).toContain('This message was removed');
  });

  it('offers a retry on a failed send', () => {
    const tree = render({
      type: 'pending',
      key: 'pending-p1',
      entry: {
        clientMessageId: 'p1',
        body: 'hello',
        uploadIds: [],
        attachmentNames: [],
        context: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        status: 'failed',
        error: 'You appear to be offline',
      },
    });
    expect(texts(tree)).toContain('You appear to be offline');
    const retry = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Retry sending',
    )[0];
    act(() => retry.props.onPress());
    expect(mockRetry).toHaveBeenCalledWith('p1');
  });

  it('signs agent replies with a capitalised first name', () => {
    expect(agentDisplayName('eli smargon')).toBe('Eli');
    expect(agentDisplayName('dana@fuse.io')).toBe('Dana');
    expect(agentDisplayName('  ')).toBe('Solid Support');
    expect(agentDisplayName(null)).toBe('Solid Support');
  });
});
