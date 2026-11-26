import Toast from 'react-native-toast-message';

import BlackFridayDrawer from '@/components/Promotions/BlackFridayDrawer';

import type { ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Card/NewCardDetails/SpendMode/CardBottomSheet', () => ({
  __esModule: true,
  default: ({ children }: { children: (options: { presentation: 'modal' }) => ReactNode }) =>
    children({ presentation: 'modal' }),
}));
jest.mock('@/components/Promotions/BlackFridayDrawerHero', () => ({
  __esModule: true,
  default: 'BlackFridayDrawerHero',
}));
jest.mock('@/hooks/useReferralCountdown', () => ({
  useReferralCountdown: () => ({ isElapsed: false, label: '7d 12h' }),
}));

const prime = { beforeUsd: 199, saleUsd: 139, endsAt: '2026-12-04T00:00:00Z', preview: false };
const ultra = { ...prime, beforeUsd: 999, saleUsd: 699 };
let root: ReturnType<typeof create>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

afterEach(() => act(() => root?.unmount()));

it('closes the drawer and reports a rejected See the tiers action', async () => {
  const onOpenChange = jest.fn();
  const onSeeTiers = jest.fn().mockRejectedValue(new Error('Unable to open browser'));
  act(() => {
    root = create(
      <BlackFridayDrawer
        prime={prime}
        ultra={ultra}
        isOpen
        onOpenChange={onOpenChange}
        onSeeTiers={onSeeTiers}
      />,
    );
  });

  await act(async () => root.root.findByType('Button').props.onPress());

  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onSeeTiers).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith({ type: 'error', text1: 'Unable to open the link' });
});
