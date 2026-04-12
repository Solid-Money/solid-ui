import { fuse, mainnet } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { getAllowedTokensForChain, resolveDepositBridgeTokenKey } from '@/lib/vaults';

describe('resolveDepositBridgeTokenKey', () => {
  const usdcVault = VAULTS[0];
  const fuseVault = VAULTS[1];

  it('maps legacy vault receipt token soUSD to an allowed principal on FUSE vault', () => {
    const resolved = resolveDepositBridgeTokenKey(fuse.id, 'soUSD', fuseVault);
    expect(getAllowedTokensForChain(fuse.id, fuseVault)).toContain(resolved);
    expect(resolved).not.toMatch(/^so/i);
  });

  it('keeps a valid bridge token when allowed for the vault', () => {
    expect(resolveDepositBridgeTokenKey(fuse.id, 'WFUSE', fuseVault)).toBe('WFUSE');
  });

  it('defaults USDC vault deposit token on mainnet from legacy soUSD', () => {
    expect(resolveDepositBridgeTokenKey(mainnet.id, 'soUSD', usdcVault)).toBe('USDC');
  });
});
