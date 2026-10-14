import React from 'react';
import { Linking } from 'react-native';

import MessageAttachments from '@/components/Support/MessageAttachments';
import { message } from '@/lib/support/__tests__/fixtures';
import { attachmentUrl } from '@/lib/support/sync';
import { useUserStore } from '@/store/useUserStore';

import type { SupportAttachment } from '@/lib/types/support';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
jest.mock('@/lib/mmvkStorage', () => () => ({
  getItem: () => null,
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/lib/support/sync', () => ({
  attachmentUrl: jest.fn(),
  isLinkFresh: () => false,
  refreshMessage: jest.fn(),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const file: SupportAttachment = {
  key: 'file-1',
  mime: 'application/pdf',
  size: 100,
  fileName: 'Statement.pdf',
  width: null,
  height: null,
  blurhash: null,
  url: 'https://files.test/old',
  status: 'clean',
};
const mockAttachmentUrl = attachmentUrl as jest.Mock;
let tree: any;
let open: jest.SpyInstance;
beforeEach(() => {
  useUserStore.setState({ users: [{ userId: 'account-a', selected: true } as never] });
  mockAttachmentUrl.mockReset();
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  open.mockClear();
  act(() => {
    tree = create(<MessageAttachments message={message({ attachments: [file] })} />);
  });
});
afterEach(() => {
  act(() => tree.unmount());
  jest.restoreAllMocks();
});
const press = () =>
  tree.root
    .findAll((node: any) => node.props.accessibilityLabel === 'Open Statement.pdf')[0]
    .props.onPress();

it('handles link refresh and viewer rejections and lets the user retry', async () => {
  mockAttachmentUrl
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue('https://files.test/fresh');
  await act(async () => {
    press();
  });
  expect(open).not.toHaveBeenCalled();
  open.mockRejectedValueOnce(new Error('Unsupported viewer'));
  await act(async () => {
    press();
  });
  await act(async () => {
    press();
  });
  expect(mockAttachmentUrl).toHaveBeenCalledTimes(3);
  expect(open).toHaveBeenCalledTimes(2);
});

it('does not open a private file after switching accounts during its refresh', async () => {
  let finish!: (url: string) => void;
  mockAttachmentUrl.mockReturnValue(new Promise<string>(resolve => (finish = resolve)));
  await act(async () => {
    press();
  });
  useUserStore.setState({ users: [{ userId: 'account-b', selected: true } as never] });
  await act(async () => {
    finish('https://files.test/private');
  });
  expect(open).not.toHaveBeenCalled();
});
