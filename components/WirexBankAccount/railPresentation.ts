/**
 * Rail presentation and selection for the Wirex bank-account screen.
 *
 * Free of React and UI imports so it can be unit-tested directly — importing
 * the component would drag in the `@/lib/utils` barrel and, through it, wagmi's
 * ESM build, which Jest cannot parse. Same split as transferFormState.ts.
 */
import {
  WirexBankAccountType,
  WirexBankOverviewDto,
  WirexBankRailStatusDto,
} from '@/lib/types/wirex-bank';

/** One label-above-value row on the details card. */
export interface BankAccountDetailRow {
  label: string;
  value: string;
}

export interface RailPresentation {
  /** Short currency label for the switcher. */
  label: string;
  title: string;
  blurb: string;
  flag: 'images/eu.png' | 'images/us.png';
}

/** Per-rail copy. Everything else about the two rails is identical. */
export const RAIL_PRESENTATION: Record<WirexBankAccountType, RailPresentation> = {
  [WirexBankAccountType.SEPA]: {
    label: 'EUR',
    title: 'Virtual EUR account',
    blurb: 'Receive euro transfers straight into your Solid account over SEPA',
    flag: 'images/eu.png',
  },
  [WirexBankAccountType.ACH]: {
    label: 'USD',
    title: 'Virtual USD account',
    blurb: 'Receive dollar transfers straight into your Solid account over ACH',
    flag: 'images/us.png',
  },
};

/**
 * The requisites for one rail, in the order a payer reads them off.
 *
 * SEPA is IBAN + BIC; ACH is account + routing. The account holder leads when
 * Wirex has told us one — a payer's bank asks for the name before the number.
 */
export function detailRows(rail: WirexBankRailStatusDto): BankAccountDetailRow[] {
  const account = rail.account;
  if (!account) return [];

  const holder: BankAccountDetailRow[] = account.accountHolder
    ? [{ label: 'Account holder', value: account.accountHolder }]
    : [];

  return rail.accountType === WirexBankAccountType.SEPA
    ? [
        ...holder,
        { label: 'IBAN', value: account.iban ?? '' },
        { label: 'BIC', value: account.bic ?? '' },
      ]
    : [
        ...holder,
        { label: 'Account number', value: account.accountNumber ?? '' },
        { label: 'Routing number', value: account.routingNumber ?? '' },
      ];
}

/**
 * Why a rail is closed to this user.
 *
 * `NotFulfilled` is the one that is actionable — the user can finish a higher
 * verification level — so it must not be flattened into the generic message.
 */
export function unavailableReason(capabilityStatus: string, label: string): string {
  switch (capabilityStatus) {
    case 'NotFulfilled':
      return 'Finish identity verification and this will unlock.';
    case 'NotAvailable':
      return `${label} accounts aren't offered in your country of residence.`;
    default:
      return 'Check back later, or contact support if you were expecting access.';
  }
}

/**
 * Rails worth putting on screen.
 *
 * A rail the user can neither use nor open is noise — a UK resident should not
 * see an empty "USD account" tab they can do nothing with.
 */
export function visibleRails(overview: WirexBankOverviewDto | undefined): WirexBankRailStatusDto[] {
  return (overview?.rails ?? []).filter(rail => rail.account || rail.canActivate || rail.isPending);
}

/**
 * The rail to show: the user's choice, else the first that can actually
 * receive, else the first visible one.
 *
 * Preferring a receivable rail means a user with one live account and one still
 * provisioning opens on the live one rather than on a spinner.
 */
export function selectActiveRail(
  rails: WirexBankRailStatusDto[],
  selected: WirexBankAccountType | null,
): WirexBankRailStatusDto | null {
  if (selected) {
    const chosen = rails.find(rail => rail.accountType === selected);
    if (chosen) return chosen;
  }
  return rails.find(rail => rail.account?.canReceive) ?? rails[0] ?? null;
}

/** Whether an outbound transfer is possible on this rail at all. */
export function canSendFrom(rail: WirexBankRailStatusDto): boolean {
  return !!rail.account?.canReceive && (rail.canSendToOwnAccount || rail.canSendToThirdParty);
}

/**
 * Swap one rail into a cached overview, leaving the other untouched.
 *
 * Activation returns the rail's full new state, so patching beats invalidating:
 * a refetch would flash the pre-activation state first.
 */
export function replaceRail(
  overview: WirexBankOverviewDto | undefined,
  rail: WirexBankRailStatusDto,
): WirexBankOverviewDto {
  // No cached overview to patch. Activation only ever succeeds for a Wirex user
  // who has passed KYC, so those two are known; balances are left empty, which
  // the DTO defines as "unknown" — the next fetch fills them in, and inventing a
  // zero here would flash "€0.00" over a balance the user actually holds.
  if (!overview) {
    return {
      rails: [rail],
      isWirexUser: true,
      provider: 'wirex',
      kycRequired: false,
      balances: [],
    };
  }
  const rails = overview.rails.some(item => item.accountType === rail.accountType)
    ? overview.rails.map(item => (item.accountType === rail.accountType ? rail : item))
    : [...overview.rails, rail];
  return { ...overview, rails };
}
