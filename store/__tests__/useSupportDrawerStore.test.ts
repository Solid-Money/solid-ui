/// <reference types="jest" />

import {
  closeSupportDrawer,
  openSupportDrawer,
  useSupportDrawerStore,
} from '@/store/useSupportDrawerStore';

describe('useSupportDrawerStore', () => {
  afterEach(() => {
    closeSupportDrawer();
  });

  it('opens the shared drawer from any support entry point', () => {
    openSupportDrawer();

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      chatMessage: undefined,
    });
  });

  it('preserves transaction context until the drawer is closed', () => {
    openSupportDrawer('Transaction ID: 123');

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      chatMessage: 'Transaction ID: 123',
    });

    closeSupportDrawer();

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: false,
      chatMessage: undefined,
    });
  });

  it('ignores the press event a bare onPress binding passes', () => {
    // `onPress: () => void` accepts openSupportDrawer — a function with an
    // optional parameter satisfies one with none — so `onPress={openSupportDrawer}`
    // type-checks and Pressable then calls it with the press event. That object
    // reached Intercom's native message composer, which takes a string only, and
    // crashed the app rather than opening a chat.
    const pressEvent = { nativeEvent: { locationX: 12, locationY: 8 }, target: 42 };

    (openSupportDrawer as (chatMessage?: unknown) => void)(pressEvent);

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      chatMessage: undefined,
    });
  });

  it('treats blank context as no context', () => {
    openSupportDrawer('   ');

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      chatMessage: undefined,
    });
  });
});

describe('useSupportDrawerStore typed requests', () => {
  afterEach(() => {
    closeSupportDrawer();
  });

  it('carries a draft for Intercom and a reference for the in-house chat', () => {
    openSupportDrawer({
      chatMessage: 'Question about card transaction',
      context: { kind: 'card_transaction', id: 'tx_1', label: 'Starbucks · $4.50' },
    });

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      chatMessage: 'Question about card transaction',
      context: { kind: 'card_transaction', id: 'tx_1', label: 'Starbucks · $4.50' },
    });

    closeSupportDrawer();
    expect(useSupportDrawerStore.getState().context).toBeUndefined();
  });

  it('drops a context the server would refuse, so the message still sends', () => {
    openSupportDrawer({ context: { kind: 'made_up' as never, id: 'x' } });
    expect(useSupportDrawerStore.getState().context).toBeUndefined();

    openSupportDrawer({ context: { kind: 'activity', id: 'has spaces/and slashes' } });
    expect(useSupportDrawerStore.getState().context).toEqual({
      kind: 'activity',
      id: undefined,
      label: undefined,
    });
  });
});
