/**
 * KOL invite perks: what a KOL's special referral code adds for a friend who
 * signs up with it — a discount on the first year of a Prime or Ultra
 * membership, and free SEPA deposits to the euro account for their first
 * months, up to a cap. UI-free so Jest can import it.
 *
 * Everything here reads network data, so every reader tolerates a missing,
 * null or malformed field and treats it as "no perk".
 */

/** What a perk code would grant someone signing up now (`GET /referral/invite/:code`). */
export interface InvitePerk {
  /** Off the first year of the first membership; 0 when none. */
  tierDiscountPct: number;
  /** Months of free SEPA deposits from signing up; 0 when none. */
  sepaFreeMonths: number;
  /** The most deposit volume, in USD, those months make free. */
  sepaFreeCapUsd: number;
  /** Signups after this get no perk. */
  endsAt: string;
}

/** The signed-in user's own perk (`GET /kol-perks/me`). */
export interface UserKolPerk {
  kolUsername: string;
  grantedAt: string;
  tierDiscount: { pct: number; available: boolean } | null;
  sepa: {
    freeUntil: string;
    capUsd: number;
    coveredUsd: number;
    remainingUsd: number;
    waivedFeeUsd: number;
    /** The next SEPA deposit would be free: in the window, under the cap, on a plan that pays a fee. */
    active: boolean;
  } | null;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** An invite lookup's `perk`, or null when absent or unusable. */
export function readInvitePerk(raw: unknown): InvitePerk | null {
  if (!raw || typeof raw !== 'object') return null;
  const perk = raw as Partial<InvitePerk>;
  const tierDiscountPct = isCount(perk.tierDiscountPct) ? Math.round(perk.tierDiscountPct) : 0;
  const sepaFreeMonths = isCount(perk.sepaFreeMonths) ? Math.round(perk.sepaFreeMonths) : 0;
  const sepaFreeCapUsd = isCount(perk.sepaFreeCapUsd) ? perk.sepaFreeCapUsd : 0;
  if (tierDiscountPct <= 0 && sepaFreeMonths <= 0) return null;
  return {
    tierDiscountPct,
    sepaFreeMonths,
    sepaFreeCapUsd,
    endsAt: typeof perk.endsAt === 'string' ? perk.endsAt : '',
  };
}

/** `GET /kol-perks/me`'s `perk`, or null when absent or unusable. */
export function readUserKolPerk(raw: unknown): UserKolPerk | null {
  const perk = (raw as { perk?: unknown } | null | undefined)?.perk as
    | Partial<UserKolPerk>
    | null
    | undefined;
  if (!perk || typeof perk !== 'object' || typeof perk.kolUsername !== 'string') return null;

  const tier = perk.tierDiscount as Partial<NonNullable<UserKolPerk['tierDiscount']>> | null;
  const tierDiscount =
    tier && typeof tier === 'object' && isCount(tier.pct) && tier.pct > 0
      ? { pct: Math.round(tier.pct), available: tier.available === true }
      : null;

  const sepaRaw = perk.sepa as Partial<NonNullable<UserKolPerk['sepa']>> | null;
  const sepa =
    sepaRaw &&
    typeof sepaRaw === 'object' &&
    typeof sepaRaw.freeUntil === 'string' &&
    isCount(sepaRaw.capUsd)
      ? {
          freeUntil: sepaRaw.freeUntil,
          capUsd: sepaRaw.capUsd,
          coveredUsd: isCount(sepaRaw.coveredUsd) ? sepaRaw.coveredUsd : 0,
          remainingUsd: isCount(sepaRaw.remainingUsd) ? sepaRaw.remainingUsd : 0,
          waivedFeeUsd: isCount(sepaRaw.waivedFeeUsd) ? sepaRaw.waivedFeeUsd : 0,
          active: sepaRaw.active === true,
        }
      : null;

  if (!tierDiscount && !sepa) return null;
  return {
    kolUsername: perk.kolUsername,
    grantedAt: typeof perk.grantedAt === 'string' ? perk.grantedAt : '',
    tierDiscount,
    sepa,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23 Dec", in UTC, or '' for an unreadable date. */
export function perkDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "$10,000", whole dollars. */
export function perkUsd(amount: number): string {
  return `$${Math.floor(amount).toLocaleString('en-US')}`;
}

const monthsLabel = (months: number) => (months === 1 ? 'month' : `${months} months`);

/** "50% off Prime & Ultra + free SEPA", for the one line under the invite code field. */
export function invitePerkShort(perk: InvitePerk): string {
  const parts: string[] = [];
  if (perk.tierDiscountPct > 0) parts.push(`${perk.tierDiscountPct}% off Prime & Ultra`);
  if (perk.sepaFreeMonths > 0) parts.push('free SEPA');
  return parts.join(' + ');
}

/** "free SEPA deposits for your first month, up to $10,000", to sit mid-sentence. */
export function sepaPerkPhrase(
  perk: Pick<InvitePerk, 'sepaFreeMonths' | 'sepaFreeCapUsd'>,
): string {
  const cap = perk.sepaFreeCapUsd > 0 ? `, up to ${perkUsd(perk.sepaFreeCapUsd)}` : '';
  return `free SEPA deposits for your first ${monthsLabel(perk.sepaFreeMonths)}${cap}`;
}

/** "Free SEPA deposits for your first month, up to $10,000". */
export function sepaPerkSentence(
  perk: Pick<InvitePerk, 'sepaFreeMonths' | 'sepaFreeCapUsd'>,
): string {
  const phrase = sepaPerkPhrase(perk);
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
}

/**
 * The euro account screen's notice while the user's free SEPA months run:
 * "Your SEPA deposits are free until 23 Dec", and what is left of the cap.
 * Null when there is nothing to tell them.
 */
export function kolSepaPerkCopy(perk: UserKolPerk | null): { title: string; body: string } | null {
  if (!perk?.sepa?.active) return null;
  const day = perkDay(perk.sepa.freeUntil);
  return {
    title: day ? `Your SEPA deposits are free until ${day}` : 'Your SEPA deposits are free',
    body:
      `€0 fee on your next ${perkUsd(perk.sepa.remainingUsd)} of deposits, ` +
      `thanks to ${perk.kolUsername}'s invite.`,
  };
}

/** "50% off your first year with artem.betev's invite", or '' when there is none to take. */
export function inviteDiscountLine(
  discount: { pct: number; inviterUsername: string } | null | undefined,
): string {
  if (!discount || !(discount.pct > 0)) return '';
  return discount.inviterUsername
    ? `${discount.pct}% off your first year with ${discount.inviterUsername}'s invite`
    : `${discount.pct}% off your first year`;
}
