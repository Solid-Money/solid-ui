import { createWalletLinkChallenge, getLinkedWallets, linkWallet } from '@/lib/api';
import { ensureWalletLinked, isOwnSafe } from '@/lib/deposit/externalWallet';

jest.mock('@/lib/api', () => ({
  getLinkedWallets: jest.fn(),
  createWalletLinkChallenge: jest.fn(),
  linkWallet: jest.fn(),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

const SAFE = '0x4d22bE2509C4c0B7902BF542E1460c6cE1f210f7';
const EOA = '0x1111111111111111111111111111111111111111';

const linked = getLinkedWallets as jest.Mock;
const challenge = createWalletLinkChallenge as jest.Mock;
const link = linkWallet as jest.Mock;

const wallet = (address = EOA) => ({
  address,
  signMessage: jest.fn().mockResolvedValue('0xsigned'),
});

beforeEach(() => {
  jest.clearAllMocks();
  linked.mockResolvedValue([]);
  challenge.mockResolvedValue({ message: 'Link this wallet', expiresAt: '' });
  link.mockResolvedValue({ address: EOA, linkedAt: '' });
});

describe('isOwnSafe', () => {
  it('accepts the user’s own Safe in any casing', () => {
    expect(isOwnSafe(SAFE.toLowerCase(), SAFE)).toBe(true);
  });

  it('refuses a connected external wallet', () => {
    expect(isOwnSafe(EOA, SAFE)).toBe(false);
  });

  it('refuses when either address is missing', () => {
    expect(isOwnSafe(undefined, SAFE)).toBe(false);
    expect(isOwnSafe(SAFE, undefined)).toBe(false);
  });
});

describe('ensureWalletLinked', () => {
  it('signs the server’s message and links a wallet that isn’t linked yet', async () => {
    const account = wallet();
    const onSignRequest = jest.fn();

    await ensureWalletLinked(account as never, SAFE, { onSignRequest });

    expect(challenge).toHaveBeenCalledWith(EOA);
    expect(onSignRequest).toHaveBeenCalledTimes(1);
    expect(account.signMessage).toHaveBeenCalledWith({ message: 'Link this wallet' });
    expect(link).toHaveBeenCalledWith(EOA, '0xsigned');
  });

  it('asks for nothing when the wallet is already linked', async () => {
    linked.mockResolvedValue([{ address: EOA.toUpperCase().replace('0X', '0x'), linkedAt: '' }]);
    const account = wallet();

    await ensureWalletLinked(account as never, SAFE);

    expect(account.signMessage).not.toHaveBeenCalled();
    expect(challenge).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
  });

  it('asks for nothing when depositing from the user’s own Safe', async () => {
    const account = wallet(SAFE);

    await ensureWalletLinked(account as never, SAFE);

    expect(linked).not.toHaveBeenCalled();
    expect(account.signMessage).not.toHaveBeenCalled();
  });

  it('does not link when the wallet declines to sign', async () => {
    const account = wallet();
    account.signMessage.mockRejectedValue(new Error('User rejected'));

    await expect(ensureWalletLinked(account as never, SAFE)).rejects.toThrow('User rejected');
    expect(link).not.toHaveBeenCalled();
  });

  it('refuses without a connected wallet', async () => {
    await expect(ensureWalletLinked(undefined, SAFE)).rejects.toThrow('EOA not connected');
  });
});
