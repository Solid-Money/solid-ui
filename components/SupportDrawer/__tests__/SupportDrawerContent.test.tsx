import React from 'react';

import SupportDrawerContent from '@/components/SupportDrawer/SupportDrawerContent';
import { useSupportChatStore } from '@/store/useSupportChatStore';
import { openSupportDrawer, takeHeldSupportRequest } from '@/store/useSupportDrawerStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockNativeChat = false;
const mockPush = jest.fn();
const mockIntercom = { show: jest.fn(), showNewMessage: jest.fn(), update: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useSupportChat', () => ({ useOpensSupportChat: () => mockNativeChat }));
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
    // Held for Intercom in case the chat screen learns the answer is no.
    expect(takeHeldSupportRequest()).toEqual({
      chatMessage: 'Question about card transaction',
      context: { kind: 'card_transaction', id: 'tx_1', label: 'Starbucks' },
    });
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

  it('sets the error reference on the Intercom contact before the message opens', () => {
    mockNativeChat = false;
    // What the failure sheet holds when the chat screen learns the answer is no.
    openSupportDrawer({
      chatMessage: 'My send failed',
      intercomAttributes: { last_error_ref: 'AB12CD34', last_error_code: 'send_failed' },
    });
    pressChat();

    expect(mockIntercom.update).toHaveBeenCalledWith({
      customAttributes: { last_error_ref: 'AB12CD34', last_error_code: 'send_failed' },
    });
    expect(mockIntercom.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockIntercom.showNewMessage.mock.invocationCallOrder[0],
    );
    expect(mockIntercom.showNewMessage).toHaveBeenCalledWith('My send failed');
  });

  it('holds the error reference too when it goes to the in-house chat', () => {
    mockNativeChat = true;
    openSupportDrawer({
      chatMessage: 'My send failed',
      intercomAttributes: { last_error_ref: 'AB12CD34' },
    });
    pressChat();

    expect(mockIntercom.update).not.toHaveBeenCalled();
    expect(takeHeldSupportRequest()).toEqual({
      chatMessage: 'My send failed',
      intercomAttributes: { last_error_ref: 'AB12CD34' },
    });
  });
});
