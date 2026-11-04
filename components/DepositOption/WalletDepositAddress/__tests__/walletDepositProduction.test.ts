import { getAllWalletDepositTokens } from '@/components/DepositOption/WalletDepositAddress/constants';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { RhinoAssetsState } from '@/lib/rhinoDeposit';

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  isDevFeatureEnabled: false,
}));

const rhino: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };

describe('in production', () => {
  /**
   * SLVx is an xStock, and stocks are an in-development feature: it is offered
   * where Stocks is, on qa/preview builds, and not in production until it has
   * cleared compliance — not even to the team members given the new tokens.
   */
  it('leaves SLVx out of "Select token"', () => {
    const symbols = getAllWalletDepositTokens({ hasNewTokens: true, rhino }).map(
      token => token.symbol,
    );

    expect(symbols).not.toContain('SLVx');
    expect(symbols).toContain('cbBTC');
  });

  it('lists only what everyone had before for someone not given the new tokens', () => {
    expect(getAllWalletDepositTokens({ rhino }).map(token => token.symbol)).toEqual([
      'USDC',
      'USDT',
      'ETH',
      'FUSE',
      'WETH',
      'WFUSE',
    ]);
  });
});
