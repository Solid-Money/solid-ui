import {
  buildProjectionSeries,
  simulationApy,
} from '@/components/Savings/NewSavings/savingsProjection';
import { VaultType } from '@/lib/types';

describe('simulationApy', () => {
  it('runs at the reported APY whenever there is one', () => {
    expect(simulationApy(VaultType.USDC, 4.2)).toBe(4.2);
    expect(simulationApy(VaultType.EUR, 1.5)).toBe(1.5);
  });

  it('keeps the illustrative 5% for a USD-valued vault without a rate', () => {
    expect(simulationApy(VaultType.USDC, 0)).toBe(5);
    expect(simulationApy(VaultType.ETH, undefined)).toBe(5);
  });

  // soEURC does not earn yet: its simulation must not show yield it never paid.
  it('projects the EUR vault flat until it reports a rate', () => {
    expect(simulationApy(VaultType.EUR, undefined)).toBe(0);
    expect(simulationApy(VaultType.EUR, 0)).toBe(0);
    const series = buildProjectionSeries(10_000, simulationApy(VaultType.EUR, undefined));
    expect(series.at(-1)?.value).toBe(10_000);
  });
});
