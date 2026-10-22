import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { downloadStatement, getAvailableStatements } from '@/lib/api';
import { saveStatementFile } from '@/lib/statementFile';
import { StatementFormat } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const AVAILABLE_STATEMENTS_QUERY_KEY = 'availableStatements';

const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

/**
 * The months a statement can be downloaded for, each with its card spend, and a
 * download that builds the month's statement on the server — a PDF to read or a
 * CSV for spreadsheets — and hands the file over.
 *
 * Statements are built on request, never cached here: downloading a month again
 * always shows the latest data — a refund that landed late, a pending row that
 * settled.
 */
export const useStatements = () => {
  const userId = useSelectedUserId();
  // The month being downloaded, so its row can show a spinner on its own.
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);

  const months = useQuery({
    queryKey: [AVAILABLE_STATEMENTS_QUERY_KEY, userId],
    queryFn: () => withRefreshToken(() => getAvailableStatements()),
    enabled: !!userId,
    retry: 1,
  });

  const download = useMutation({
    mutationFn: async ({ month, format }: { month: string; format: StatementFormat }) => {
      track(TRACKING_EVENTS.STATEMENT_DOWNLOAD_TAPPED, { month, format });
      const file = await withRefreshToken(() => downloadStatement(month, format));
      return saveStatementFile(file);
    },
    onMutate: ({ month }) => setPendingMonth(month),
    onError: (error, { month, format }) => {
      track(TRACKING_EVENTS.STATEMENT_DOWNLOAD_FAILED, {
        month,
        format,
        status: error instanceof Response ? error.status : undefined,
      });
    },
    onSettled: () => setPendingMonth(null),
  });

  return {
    months: months.data?.months ?? [],
    isLoading: months.isLoading,
    isError: months.isError,
    pendingMonth,
    download: (month: string, format: StatementFormat) => download.mutateAsync({ month, format }),
  };
};

/** "September 2026" for `2026-09`. Months are UTC calendar months, like the statements. */
export const formatStatementMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
