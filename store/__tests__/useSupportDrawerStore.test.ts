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
});
