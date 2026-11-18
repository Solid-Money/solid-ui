import { isSupportChatConfigured, supportCall } from '@/lib/api/support';

/**
 * Known incidents for the Home notice (flash-support-service,
 * `/support/v1/incidents`): the active ones, and ones fixed in the last two
 * hours. Only the wording the team approved for customers, posted from
 * Portal › Support › Settings or the Solid Support connector.
 *
 * Backend: apps/flash-support-service/src/chat/incidents.controller.ts in solid-backend.
 */
export interface KnownIncident {
  id: string;
  title: string;
  message: string;
  active: boolean;
  startedAt: string | null;
  /** Changes whenever the wording does, so closing the notice lasts until the next update. */
  updatedAt: string | null;
  resolvedAt: string | null;
}

const timeOrNull = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
};

/** The incident if the notice can show it, or null. */
export const toKnownIncident = (value: unknown): KnownIncident | null => {
  const raw = value as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;
  const { id, title, message, active } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (typeof message !== 'string' || typeof active !== 'boolean') return null;
  const startedAt = timeOrNull(raw.startedAt);
  const updatedAt = timeOrNull(raw.updatedAt);
  const resolvedAt = timeOrNull(raw.resolvedAt);
  if (startedAt === undefined || updatedAt === undefined || resolvedAt === undefined) return null;
  return {
    id,
    title: title.trim(),
    message: message.trim(),
    active,
    startedAt,
    updatedAt,
    resolvedAt,
  };
};

/** Entries the notice can't show are left out rather than failing the rest. */
export const getKnownIncidents = async (signal?: AbortSignal): Promise<KnownIncident[]> => {
  if (!isSupportChatConfigured()) return [];
  const body = await supportCall<{ incidents?: unknown } | null>('/incidents', { signal });
  if (!Array.isArray(body?.incidents)) return [];
  return body.incidents.map(toKnownIncident).filter((item): item is KnownIncident => !!item);
};
