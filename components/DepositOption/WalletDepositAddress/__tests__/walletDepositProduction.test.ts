import { getAllWalletDepositTokens } from '@/components/DepositOption/WalletDepositAddress/constants';

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  isDevFeatureEnabled: false,
}));

/**
 * SLVx is an xStock, and stocks are an in-development feature: it is offered
 * where Stocks is, on qa/preview builds, and not in production until it has
 * cleared compliance.
 */
describe('in production', () => {
  it('leaves SLVx out of "Select token"', () => {
    const symbols = getAllWalletDepositTokens().map(token => token.symbol);

    expect(symbols).not.toContain('SLVx');
    expect(symbols).toContain('PAXG');
  });
});
