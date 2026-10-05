import { type Hex, serializeErc6492Signature } from 'viem';

import {
  SmartAccountNotDeployedError,
  toErc1271Signature,
  waitForSmartAccountDeployment,
} from '@/lib/smartAccountSigning';

/** A 65-byte Safe owner signature (r, s, v). */
const OWNER_SIGNATURE: Hex = `0x${'31'.repeat(32)}${'3f'.repeat(32)}1b`;
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
const FACTORY_DATA: Hex = '0x1688f0b9deadbeef';

describe('toErc1271Signature', () => {
  it('returns the owner signature from inside an ERC-6492 wrapper', () => {
    // What viem produces when it thinks the Safe is still counterfactual — the
    // shape Rain's coordinator rejected with InvalidSignature().
    const wrapped = serializeErc6492Signature({
      address: SAFE_PROXY_FACTORY,
      data: FACTORY_DATA,
      signature: OWNER_SIGNATURE,
    });
    expect(wrapped.endsWith('6492'.repeat(16))).toBe(true);

    expect(toErc1271Signature(wrapped)).toBe(OWNER_SIGNATURE);
  });

  it('leaves a plain signature unchanged', () => {
    expect(toErc1271Signature(OWNER_SIGNATURE)).toBe(OWNER_SIGNATURE);
  });
});

describe('waitForSmartAccountDeployment', () => {
  it('resolves at once for a deployed account', async () => {
    const isDeployed = jest.fn().mockResolvedValue(true);

    await waitForSmartAccountDeployment({ isDeployed }, { intervalMs: 0 });

    expect(isDeployed).toHaveBeenCalledTimes(1);
  });

  it('keeps asking until the RPC catches up with the deployment', async () => {
    const isDeployed = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await waitForSmartAccountDeployment({ isDeployed }, { intervalMs: 0 });

    expect(isDeployed).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt instead of signing as counterfactual', async () => {
    const isDeployed = jest.fn().mockResolvedValue(false);

    await expect(
      waitForSmartAccountDeployment({ isDeployed }, { attempts: 3, intervalMs: 0 }),
    ).rejects.toBeInstanceOf(SmartAccountNotDeployedError);
    expect(isDeployed).toHaveBeenCalledTimes(3);
  });
});
