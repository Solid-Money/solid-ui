import { format, isValid, parseISO } from 'date-fns';

export function parseChartTime(time: number | string): Date {
  try {
    return typeof time === 'number' ? new Date(time) : parseISO(String(time).trim());
  } catch {
    return new Date(NaN);
  }
}

/** Short label for chart axis (e.g. "Jul 10") */
export function formatChartAxisLabel(time: number | string): string {
  const date = parseChartTime(time);
  return isValid(date) ? format(date, 'MMM d') : '—';
}

/** Full date for chart tooltip (e.g. "Jul 10, 2025") */
export function formatChartTooltipDate(time: number | string): string {
  const date = parseChartTime(time);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : '—';
}
