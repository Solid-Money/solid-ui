import { askToPayNetworkFee, useNetworkFeeStore } from '@/store/useNetworkFeeStore';

const request = {
  chainId: 1,
  network: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
  maxFee: 1_185_640_585_805_478n,
};

afterEach(() =>
  useNetworkFeeStore.setState({ isOpen: false, request: undefined, resolve: undefined }),
);

it('opens with the request and resolves to the answer', async () => {
  const answer = askToPayNetworkFee(request);
  expect(useNetworkFeeStore.getState()).toMatchObject({ isOpen: true, request });

  useNetworkFeeStore.getState().answer(true);

  await expect(answer).resolves.toBe(true);
  expect(useNetworkFeeStore.getState().isOpen).toBe(false);
});

it('declines a request still on screen when a newer one asks', async () => {
  const first = askToPayNetworkFee(request);
  const second = askToPayNetworkFee({ ...request, maxFee: 2n });

  await expect(first).resolves.toBe(false);
  expect(useNetworkFeeStore.getState().request?.maxFee).toBe(2n);

  useNetworkFeeStore.getState().answer(false);
  await expect(second).resolves.toBe(false);
});
