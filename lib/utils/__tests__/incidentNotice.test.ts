import {
  incidentNotice,
  isUpdatedIncident,
  liveIncidentIds,
  noticeKey,
  RESOLVED_NOTICE_MS,
} from '@/lib/utils/incidentNotice';

import type { KnownIncident } from '@/lib/api/incidents';

const POSTED = '2026-10-29T10:00:00.000Z';

const incident = (id: string, changes: Partial<KnownIncident> = {}): KnownIncident => ({
  id,
  title: 'Card payments are delayed',
  message: 'Some card payments are slower. Your money is safe.',
  active: true,
  startedAt: POSTED,
  updatedAt: POSTED,
  resolvedAt: null,
  ...changes,
});

const none = { dismissed: [], seen: [] };
const now = Date.parse('2026-10-29T11:00:00.000Z');

describe('incidentNotice', () => {
  it('shows nothing without incidents', () => {
    expect(incidentNotice([], none, now)).toBeNull();
  });

  it('shows one active incident, and marks it as an update once reworded', () => {
    expect(incidentNotice([incident('a')], none, now)).toMatchObject({
      kind: 'single',
      tone: 'active',
      keys: [`a@${POSTED}`],
    });
    const reworded = incident('a', { updatedAt: '2026-10-29T10:30:00.000Z' });
    expect(incidentNotice([reworded], none, now)).toMatchObject({ tone: 'update' });
    // A fix a few seconds after posting is not an update.
    expect(isUpdatedIncident(incident('a', { updatedAt: '2026-10-29T10:00:20.000Z' }))).toBe(false);
  });

  it('stays closed until the wording changes', () => {
    const live = incident('a');
    const closed = { dismissed: [noticeKey(live)], seen: ['a'] };
    expect(incidentNotice([live], closed, now)).toBeNull();
    const update = incident('a', { updatedAt: '2026-10-29T10:45:00.000Z' });
    expect(incidentNotice([update], closed, now)).toMatchObject({ tone: 'update' });
  });

  it('puts two or more active incidents in one card, and closing it closes them all', () => {
    const notice = incidentNotice([incident('a'), incident('b')], none, now);
    expect(notice).toMatchObject({ kind: 'multiple', keys: [`a@${POSTED}`, `b@${POSTED}`] });
    expect(liveIncidentIds(notice)).toEqual(['a', 'b']);
    expect(
      incidentNotice([incident('a'), incident('b')], { ...none, dismissed: notice!.keys }, now),
    ).toBeNull();
  });

  it('says a fixed incident is back to normal, only to people who saw it, for two hours', () => {
    const resolvedAt = '2026-10-29T10:30:00.000Z';
    const fixed = incident('a', { active: false, resolvedAt, updatedAt: resolvedAt });
    expect(incidentNotice([fixed], none, now)).toBeNull();

    const sawIt = { dismissed: [noticeKey(incident('a'))], seen: ['a'] };
    const notice = incidentNotice([fixed], sawIt, now);
    expect(notice).toMatchObject({ kind: 'single', tone: 'resolved' });
    expect(liveIncidentIds(notice)).toEqual([]);

    const later = Date.parse(resolvedAt) + RESOLVED_NOTICE_MS + 1;
    expect(incidentNotice([fixed], sawIt, later)).toBeNull();
  });

  it('keeps the fixed one back while another incident is still live', () => {
    const fixed = incident('a', { active: false, resolvedAt: '2026-10-29T10:30:00.000Z' });
    expect(
      incidentNotice([fixed, incident('b')], { dismissed: [], seen: ['a'] }, now),
    ).toMatchObject({ tone: 'active', incident: { id: 'b' } });
  });
});
