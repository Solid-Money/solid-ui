import React from 'react';

import SupportDrawerContent from '@/components/SupportDrawer/SupportDrawerContent';
import { useSupportChatStore } from '@/store/useSupportChatStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockNativeChat = false;
const mockPush = jest.fn();
const mockIntercom = { show: jest.fn(), showNewMessage: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useSupportChat', () => ({ useSupportChatEnabled: () => mockNativeChat }));
jest.mock('@/lib/intercom', () => ({ useIntercom: () => mockIntercom }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));

const pressChat = () => {
  let tree: any;
  act(() => {
    tree = create(<SupportDrawerContent />);
  });
  const row = tree.root.find(
    (node: any) => node.props.onPress && node.findAllByProps({ children: 'Chat with us' }).length,
  );
  act(() => row.props.onPress());
  act(() => jest.runAllTimers());
  act(() => tree.unmount());
};

describe('SupportDrawerContent chat row', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useSupportChatStore.getState().reset();
  });
  afterEach(() => jest.useRealTimers());

  it('opens the in-house chat with what the user was looking at', () => {
    mockNativeChat = true;
    openSupportDrawer({
      chatMessage: 'Question about card transaction',
      context: { kind: 'card_transaction', id: 'tx_1', label: 'Starbucks' },
    });
    pressChat();

    expect(mockPush).toHaveBeenCalledWith('/support');
    expect(useSupportChatStore.getState().draftContext).toEqual({
      kind: 'card_transaction',
      id: 'tx_1',
      label: 'Starbucks',
    });
    expect(mockIntercom.showNewMessage).not.toHaveBeenCalled();
  });

  it('keeps Intercom, with its prefilled draft, for everyone else', () => {
    mockNativeChat = false;
    openSupportDrawer({
      chatMessage: 'Question about card transaction',
      context: { kind: 'card_transaction', id: 'tx_1' },
    });
    pressChat();

    expect(mockIntercom.showNewMessage).toHaveBeenCalledWith('Question about card transaction');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
