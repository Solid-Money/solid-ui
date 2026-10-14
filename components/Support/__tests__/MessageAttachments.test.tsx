import React from 'react';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';

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
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
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
  jest.mocked(Toast.show).mockClear();
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
  expect(Toast.show).toHaveBeenCalledWith({
    type: 'error',
    text1: "Couldn't open this file",
    text2: 'Check your connection and tap it again.',
  });
  open.mockRejectedValueOnce(new Error('Unsupported viewer'));
  await act(async () => {
    press();
  });
  await act(async () => {
    press();
  });
  expect(mockAttachmentUrl).toHaveBeenCalledTimes(3);
  expect(open).toHaveBeenCalledTimes(2);
  expect(Toast.show).toHaveBeenCalledTimes(2);
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
  expect(Toast.show).not.toHaveBeenCalled();
});

it("does not show a previous account's refresh failure after switching accounts", async () => {
  let reject!: (error: Error) => void;
  mockAttachmentUrl.mockReturnValue(new Promise<string>((_, fail) => (reject = fail)));
  await act(async () => {
    press();
  });
  useUserStore.setState({ users: [{ userId: 'account-b', selected: true } as never] });
  await act(async () => {
    reject(new Error('Expired link'));
  });
  expect(open).not.toHaveBeenCalled();
  expect(Toast.show).not.toHaveBeenCalled();
});
