import type { KnownIncident } from '@/lib/api/incidents';

/** How long a fixed incident still shows, and only to people who saw it while it was live. */
export const RESOLVED_NOTICE_MS = 2 * 60 * 60 * 1000;

/** An edit this soon after posting is a quick correction, not an update worth a pill. */
const UPDATE_GRACE_MS = 60 * 1000;

/**
 * One showing of an incident. The key changes whenever its wording does (and
 * when it is resolved), so closing the notice lasts until the next update.
 */
export const noticeKey = (incident: KnownIncident): string =>
  `${incident.id}@${incident.updatedAt ?? incident.startedAt ?? ''}`;

const timeOf = (value: string | null): number => (value ? Date.parse(value) : NaN);

/** Reworded after it was first posted. */
export const isUpdatedIncident = (incident: KnownIncident): boolean =>
  incident.active && timeOf(incident.updatedAt) - timeOf(incident.startedAt) > UPDATE_GRACE_MS;

export type IncidentNotice =
  | {
      kind: 'single';
      tone: 'active' | 'update' | 'resolved';
      incident: KnownIncident;
      /** What closing it hides. */
      keys: string[];
    }
  | { kind: 'multiple'; incidents: KnownIncident[]; keys: string[] };

export interface IncidentNoticeMemory {
  /** Notice keys this device closed. */
  dismissed: readonly string[];
  /** Incident ids this device showed while they were active. */
  seen: readonly string[];
}

/**
 * What the Home notice shows, if anything:
 * - two or more active incidents → one "N known issues" card;
 * - one → that incident, marked as an update once it has been reworded;
 * - none active → a recently fixed one, as back to normal, but only for
 *   people who saw it while it was live (nobody needs to hear about a problem
 *   that came and went while they were away).
 * Anything this device closed stays hidden until its wording changes.
 */
export function incidentNotice(
  incidents: readonly KnownIncident[],
  memory: IncidentNoticeMemory,
  now = Date.now(),
): IncidentNotice | null {
  const dismissed = new Set(memory.dismissed);
  const seen = new Set(memory.seen);
  const open = incidents.filter(incident => !dismissed.has(noticeKey(incident)));

  const active = open.filter(incident => incident.active);
  if (active.length >= 2) {
    return { kind: 'multiple', incidents: active, keys: active.map(noticeKey) };
  }
  if (active.length === 1) {
    const [incident] = active;
    return {
      kind: 'single',
      tone: isUpdatedIncident(incident) ? 'update' : 'active',
      incident,
      keys: [noticeKey(incident)],
    };
  }

  const fixed = open
    .filter(
      incident =>
        !incident.active &&
        seen.has(incident.id) &&
        now - timeOf(incident.resolvedAt) < RESOLVED_NOTICE_MS,
    )
    .sort((a, b) => timeOf(b.resolvedAt) - timeOf(a.resolvedAt));
  if (!fixed.length) return null;
  return { kind: 'single', tone: 'resolved', incident: fixed[0], keys: fixed.map(noticeKey) };
}

/** The ids a notice shows as live, to remember as seen. */
export const liveIncidentIds = (notice: IncidentNotice | null): string[] => {
  if (!notice) return [];
  if (notice.kind === 'multiple') return notice.incidents.map(incident => incident.id);
  return notice.tone === 'resolved' ? [] : [notice.incident.id];
};
