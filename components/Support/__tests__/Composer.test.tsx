import React from 'react';
import { TextInput } from 'react-native';

import Composer, { fileProblem } from '@/components/Support/Composer';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// The real helpers module pulls in wagmi, which jest cannot parse; the class joiner is all these components use.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/components/Support/AttachButton', () => () => null);
jest.mock('@/lib/support/sync', () => ({
  ACCEPTED_MIME: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
  ],
  MAX_ATTACHMENTS: 5,
  MAX_BODY_LENGTH: 10_000,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  MAX_PDF_BYTES: 20 * 1024 * 1024,
}));

const allText = (tree: any) =>
  tree.root
    .findAllByType('Text')
    .map((node: any) => [].concat(node.props.children).join(''))
    .join(' ');

describe('Composer', () => {
  it('warns about a card number before it is sent, and sends the text', () => {
    const onSend = jest.fn();
    let tree: any;
    act(() => {
      tree = create(<Composer onSend={onSend} bottomInset={0} />);
    });
    const input = tree.root.findByType(TextInput);

    act(() => input.props.onChangeText('card 4242 4242 4242 4242'));
    expect(allText(tree)).toContain('looks like a card number');

    const send = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Send' && node.props.onPress,
    )[0];
    act(() => send.props.onPress());
    expect(onSend).toHaveBeenCalledWith('card 4242 4242 4242 4242', []);
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  it('does not send an empty message', () => {
    const onSend = jest.fn();
    let tree: any;
    act(() => {
      tree = create(<Composer onSend={onSend} bottomInset={0} />);
    });
    act(() => tree.root.findByType(TextInput).props.onChangeText('   '));
    const send = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Send' && node.props.onPress,
    )[0];
    expect(send.props.disabled).toBe(true);
  });

  it('refuses files the server would refuse', () => {
    expect(fileProblem({ name: 'a.exe', mime: 'application/x-msdownload', size: 10 })).toMatch(
      /only photos and PDFs/,
    );
    expect(fileProblem({ name: 'big.jpg', mime: 'image/jpeg', size: 11 * 1024 * 1024 })).toMatch(
      /over 10 MB/,
    );
    expect(
      fileProblem({ name: 'big.pdf', mime: 'application/pdf', size: 15 * 1024 * 1024 }),
    ).toBeNull();
  });
});
