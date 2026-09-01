import {
  canSendFrom,
  detailRows,
  RAIL_PRESENTATION,
  replaceRail,
  selectActiveRail,
  unavailableReason,
  visibleRails,
} from '@/components/WirexBankAccount/railPresentation';
import {
  WirexBankAccountStatus,
  WirexBankAccountType,
  WirexBankRailStatusDto,
} from '@/lib/types/wirex-bank';

const sepaRail = (overrides: Partial<WirexBankRailStatusDto> = {}): WirexBankRailStatusDto => ({
  accountType: WirexBankAccountType.SEPA,
  currency: 'EUR',
  capabilityStatus: 'Active',
  canActivate: false,
  activationPath: 'none',
  isPending: false,
  canSendToOwnAccount: true,
  canSendToThirdParty: true,
  account: {
    id: 'account:details',
    accountType: WirexBankAccountType.SEPA,
    currency: 'EUR',
    status: WirexBankAccountStatus.ACTIVE,
    accountHolder: 'Alex Grey',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    canReceive: true,
  },
  ...overrides,
});

const achRail = (overrides: Partial<WirexBankRailStatusDto> = {}): WirexBankRailStatusDto => ({
  accountType: WirexBankAccountType.ACH,
  currency: 'USD',
  capabilityStatus: 'Active',
  canActivate: false,
  activationPath: 'none',
  isPending: false,
  canSendToOwnAccount: true,
  canSendToThirdParty: false,
  account: {
    id: 'account2:details2',
    accountType: WirexBankAccountType.ACH,
    currency: 'USD',
    status: WirexBankAccountStatus.ACTIVE,
    accountHolder: 'Alex Grey',
    accountNumber: '8310931284',
    routingNumber: '026073150',
    canReceive: true,
  },
  ...overrides,
});

describe('detailRows', () => {
  it('shows IBAN and BIC for SEPA, never ACH fields', () => {
    const rows = detailRows(sepaRail());
    expect(rows.map(row => row.label)).toEqual(['Account holder', 'IBAN', 'BIC']);
    expect(rows[1].value).toBe('DE89370400440532013000');
  });

  it('shows account and routing numbers for ACH, never SEPA fields', () => {
    const rows = detailRows(achRail());
    expect(rows.map(row => row.label)).toEqual([
      'Account holder',
      'Account number',
      'Routing number',
    ]);
    expect(rows.some(row => row.label === 'IBAN')).toBe(false);
  });

  it('omits the account holder when Wirex has not told us one', () => {
    const rows = detailRows(
      sepaRail({ account: { ...sepaRail().account!, accountHolder: undefined } }),
    );
    expect(rows.map(row => row.label)).toEqual(['IBAN', 'BIC']);
  });

  it('renders an empty string rather than "undefined" for a missing value', () => {
    const rows = detailRows(sepaRail({ account: { ...sepaRail().account!, bic: undefined } }));
    expect(rows.find(row => row.label === 'BIC')?.value).toBe('');
  });

  it('returns nothing for a rail with no account', () => {
    expect(detailRows(sepaRail({ account: undefined }))).toEqual([]);
  });
});

describe('unavailableReason', () => {
  it('points a NotFulfilled user at the verification they can finish', () => {
    // The only actionable case — it must not collapse into the generic line.
    expect(unavailableReason('NotFulfilled', 'EUR')).toContain('identity verification');
  });

  it('names the country restriction for NotAvailable', () => {
    expect(unavailableReason('NotAvailable', 'USD')).toContain('country');
  });

  it('falls back to a generic line for a status we do not enumerate', () => {
    expect(unavailableReason('SomeFutureStatus', 'EUR')).toContain('Check back');
  });
});

/**
 * An overview around some rails. `provider`/`kycRequired`/`balances` are
 * required by the DTO but say nothing about rail presentation, so they are
 * filled in once here rather than at every call site.
 */
const overviewOf = (rails: WirexBankRailStatusDto[], isWirexUser = true) => ({
  rails,
  isWirexUser,
  provider: 'wirex' as const,
  kycRequired: false,
  balances: [],
});

describe('visibleRails', () => {
  it('keeps a rail with an account', () => {
    expect(visibleRails(overviewOf([sepaRail()]))).toHaveLength(1);
  });

  it('keeps a rail the user can open', () => {
    const rail = sepaRail({ account: undefined, canActivate: true });
    expect(visibleRails(overviewOf([rail]))).toHaveLength(1);
  });

  it('keeps a rail that is still provisioning', () => {
    const rail = sepaRail({ account: undefined, isPending: true });
    expect(visibleRails(overviewOf([rail]))).toHaveLength(1);
  });

  it('drops a rail the user can neither use nor open', () => {
    // A UK resident should not see an empty USD tab they can do nothing with.
    const rail = achRail({
      account: undefined,
      canActivate: false,
      isPending: false,
      capabilityStatus: 'NotAvailable',
    });
    expect(visibleRails(overviewOf([rail]))).toEqual([]);
  });

  it('handles a missing overview', () => {
    expect(visibleRails(undefined)).toEqual([]);
  });
});

describe('selectActiveRail', () => {
  it('honours an explicit choice', () => {
    const rails = [sepaRail(), achRail()];
    expect(selectActiveRail(rails, WirexBankAccountType.ACH)?.accountType).toBe(
      WirexBankAccountType.ACH,
    );
  });

  it('ignores a choice that is no longer visible', () => {
    // e.g. the rail was closed while the screen was open.
    const rails = [sepaRail()];
    expect(selectActiveRail(rails, WirexBankAccountType.ACH)?.accountType).toBe(
      WirexBankAccountType.SEPA,
    );
  });

  it('prefers a rail that can actually receive over one still provisioning', () => {
    const pending = sepaRail({ account: undefined, isPending: true });
    const live = achRail();
    expect(selectActiveRail([pending, live], null)?.accountType).toBe(WirexBankAccountType.ACH);
  });

  it('falls back to the first rail when none can receive yet', () => {
    const pendingSepa = sepaRail({ account: undefined, isPending: true });
    const pendingAch = achRail({ account: undefined, isPending: true });
    expect(selectActiveRail([pendingSepa, pendingAch], null)?.accountType).toBe(
      WirexBankAccountType.SEPA,
    );
  });

  it('is null when there is nothing to show', () => {
    expect(selectActiveRail([], null)).toBeNull();
  });
});

describe('canSendFrom', () => {
  it('allows sending from a live rail with an outbound capability', () => {
    expect(canSendFrom(sepaRail())).toBe(true);
  });

  it('allows sending with only the first-party capability', () => {
    expect(canSendFrom(achRail())).toBe(true);
  });

  it('refuses when neither outbound capability is active', () => {
    // Offering a button that always 403s is worse than offering none.
    expect(canSendFrom(sepaRail({ canSendToOwnAccount: false, canSendToThirdParty: false }))).toBe(
      false,
    );
  });

  it('refuses when the account cannot receive yet', () => {
    // No requisites means no account to charge the payout against.
    expect(canSendFrom(sepaRail({ account: undefined }))).toBe(false);
  });
});

describe('replaceRail', () => {
  it('swaps the matching rail and leaves the other untouched', () => {
    const overview = overviewOf([sepaRail(), achRail()]);
    const updated = achRail({ capabilityStatus: 'InProgress' });

    const result = replaceRail(overview, updated);

    expect(result.rails).toHaveLength(2);
    expect(
      result.rails.find(rail => rail.accountType === WirexBankAccountType.ACH)?.capabilityStatus,
    ).toBe('InProgress');
    expect(result.rails.find(rail => rail.accountType === WirexBankAccountType.SEPA)).toEqual(
      sepaRail(),
    );
  });

  it('appends a rail the cache did not have', () => {
    const overview = overviewOf([sepaRail()]);
    expect(replaceRail(overview, achRail()).rails).toHaveLength(2);
  });

  it('creates an overview when there is no cache yet', () => {
    expect(replaceRail(undefined, sepaRail())).toEqual({
      rails: [sepaRail()],
      isWirexUser: true,
      provider: 'wirex',
      kycRequired: false,
      // Empty means unknown, not zero. A fabricated 0 would flash over a
      // balance the user actually holds until the next fetch.
      balances: [],
    });
  });

  it('does not mutate the cached overview', () => {
    // React Query compares by reference; mutating in place skips the re-render.
    const overview = overviewOf([sepaRail()]);
    const before = JSON.stringify(overview);
    replaceRail(overview, achRail());
    expect(JSON.stringify(overview)).toBe(before);
  });
});

describe('RAIL_PRESENTATION', () => {
  it('gives each rail its own flag and title', () => {
    expect(RAIL_PRESENTATION[WirexBankAccountType.SEPA]).toMatchObject({
      label: 'EUR',
      flag: 'images/eu.png',
    });
    expect(RAIL_PRESENTATION[WirexBankAccountType.ACH]).toMatchObject({
      label: 'USD',
      flag: 'images/us.png',
    });
  });
});
