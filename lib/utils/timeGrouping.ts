import { ActivityEvent, ActivityGroup, TransactionStatus } from '@/lib/types';
import { format, isToday, isYesterday } from 'date-fns';
import { isTransactionStuck } from './utils';

export type TimeGroupHeaderData = {
  title: string;
  key: string;
  status?: TransactionStatus;
  hasPendingTransactions?: boolean;
  hasCancelledTransactions?: boolean;
  hasActivePendingTransactions?: boolean;
};

export type TimeGroup<T = ActivityEvent> =
  | {
      type: ActivityGroup.HEADER;
      data: TimeGroupHeaderData;
    }
  | {
      type: ActivityGroup.TRANSACTION;
      data: T;
    };

export const formatTimeGroup = (timestamp: string): string => {
  if (!timestamp) return '';

  const transactionDate = new Date(Number(timestamp) * 1000);

  if (isToday(transactionDate)) {
    return 'Today';
  } else if (isYesterday(transactionDate)) {
    return 'Yesterday';
  } else {
    return format(transactionDate, "dd MMM yyyy");
  }
};

export const groupTransactionsByTime = (transactions: ActivityEvent[]): TimeGroup[] => {
  const grouped: TimeGroup[] = [];
  // Separate pending, cancelled and completed transactions
  const pendingTransactions = transactions.filter(tx => tx.status === TransactionStatus.PENDING);
  const cancelledTransactions = transactions.filter(
    tx => tx.status === TransactionStatus.CANCELLED,
  );
  const completedTransactions = transactions.filter(
    tx => tx.status !== TransactionStatus.PENDING && tx.status !== TransactionStatus.CANCELLED,
  );

  const hasActivePendingTransactions = pendingTransactions.some(
    tx => !isTransactionStuck(tx.timestamp),
  );

  // Add pending transactions group at the top if there are any pending or cancelled
  if (pendingTransactions.length > 0 || cancelledTransactions.length > 0) {
    grouped.push({
      type: ActivityGroup.HEADER,
      data: {
        title: 'Pending activity',
        key: 'header-pending',
        status: TransactionStatus.PENDING,
        hasPendingTransactions: pendingTransactions.length > 0,
        hasCancelledTransactions: cancelledTransactions.length > 0,
        hasActivePendingTransactions,
      },
    });

    pendingTransactions.forEach(transaction => {
      grouped.push({
        type: ActivityGroup.TRANSACTION,
        data: transaction,
      });
    });

    cancelledTransactions.forEach(transaction => {
      grouped.push({
        type: ActivityGroup.TRANSACTION,
        data: transaction,
      });
    });
  }

  // Add completed transactions grouped by time
  let currentGroup: string | null = null;
  completedTransactions.forEach(transaction => {
    const groupTitle = formatTimeGroup(transaction?.timestamp);

    // Add group header if this is a new group
    if (currentGroup !== groupTitle) {
      grouped.push({
        type: ActivityGroup.HEADER,
        data: {
          title: groupTitle,
          key: `header-${groupTitle}`,
        },
      });
      currentGroup = groupTitle;
    }

    // Add the transaction
    grouped.push({
      type: ActivityGroup.TRANSACTION,
      data: transaction,
    });
  });

  return grouped;
};

// Generic grouping function for any transaction type with timestamp
export const groupByTime = <T extends { timestamp: string | number }>(
  transactions: T[],
): TimeGroup<T>[] => {
  const grouped: TimeGroup<T>[] = [];
  let currentGroup: string | null = null;

  transactions.forEach(transaction => {
    const groupTitle = formatTimeGroup(String(transaction.timestamp));

    // Add group header if this is a new group
    if (currentGroup !== groupTitle) {
      grouped.push({
        type: ActivityGroup.HEADER,
        data: {
          title: groupTitle,
          key: `header-${groupTitle}`,
        },
      });
      currentGroup = groupTitle;
    }

    // Add the transaction
    grouped.push({
      type: ActivityGroup.TRANSACTION,
      data: transaction,
    });
  });

  return grouped;
};
