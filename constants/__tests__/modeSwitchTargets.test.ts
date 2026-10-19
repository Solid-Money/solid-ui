import { modeSwitchTargets } from '@/constants/cardSpendV2';

describe('modeSwitchTargets', () => {
  const fuse = (mode: 'cash' | 'credit' | 'smart', pendingMode: 'cash' | 'credit' | null = null) =>
    ({ mode, pendingMode }) as Parameters<typeof modeSwitchTargets>[1];

  it('switches both chains when a Safe live on Base leaves credit for debit', () => {
    expect(modeSwitchTargets('cash', fuse('credit'), { live: true, mode: 'credit' })).toEqual({
      fuse: true,
      base: true,
    });
  });

  it('leaves Base alone for a Safe that has not enabled it', () => {
    expect(modeSwitchTargets('cash', fuse('credit'), undefined)).toEqual({
      fuse: true,
      base: false,
    });
    expect(modeSwitchTargets('cash', fuse('credit'), { live: false, mode: 'credit' })).toEqual({
      fuse: true,
      base: false,
    });
  });

  // A retry after the Base leg failed: Fuse already moved, so only Base is sent.
  it('sends only Base when Fuse is already there', () => {
    expect(modeSwitchTargets('cash', fuse('cash'), { live: true, mode: 'credit' })).toEqual({
      fuse: false,
      base: true,
    });
  });

  it('sends nothing to Fuse while the same switch is armed there', () => {
    expect(modeSwitchTargets('credit', fuse('cash', 'credit'), undefined)).toEqual({
      fuse: false,
      base: false,
    });
  });

  it('sends nothing when both chains are already there', () => {
    expect(modeSwitchTargets('smart', fuse('smart'), { live: true, mode: 'smart' })).toEqual({
      fuse: false,
      base: false,
    });
  });
});
