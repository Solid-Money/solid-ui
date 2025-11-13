import { ActivityEvent, TransactionType } from '@/lib/types';

/**
 * Helper to get deduplication key - prioritize hash, then userOpHash, then clientTxId
 */
function getDedupKey(tx: ActivityEvent): string | null {
  return tx.hash || tx.userOpHash || tx.clientTxId || null;
}

/**
 * Helper to check if two transactions are duplicates
 */
function isDuplicate(a: ActivityEvent, b: ActivityEvent): boolean {
  // Same hash is always a duplicate
  if (a.hash && b.hash && a.hash === b.hash) return true;
  // Same userOpHash is a duplicate
  if (a.userOpHash && b.userOpHash && a.userOpHash === b.userOpHash) return true;
  // Same clientTxId is a duplicate
  if (a.clientTxId && b.clientTxId && a.clientTxId === b.clientTxId) return true;
  // Hash matches userOpHash or clientTxId
  if (a.hash && (a.hash === b.userOpHash || a.hash === b.clientTxId)) return true;
  if (b.hash && (b.hash === a.userOpHash || b.hash === a.clientTxId)) return true;
  return false;
}

/**
 * Check if a transaction is a card deposit
 */
function isCardDeposit(transaction: ActivityEvent): boolean {
  return (
    transaction.type === TransactionType.BRIDGE_DEPOSIT ||
    transaction.type === TransactionType.CARD_TRANSACTION ||
    (transaction.type === TransactionType.SEND &&
      transaction.toAddress &&
      transaction.metadata?.description?.toLowerCase().includes('card'))
  );
}

/**
 * Check if transaction is from analytics (has clientTxId like "TYPE-timestamp" or "TYPE-hash")
 */
function isAnalyticsTransaction(transaction: ActivityEvent): boolean {
  return (
    (typeof transaction.clientTxId === 'string' &&
      transaction.clientTxId.includes('-') &&
      !!(
        transaction.clientTxId.match(/^[A-Z_]+-\d+$/) ||
        transaction.clientTxId.match(/^[A-Z_]+-0x[a-fA-F0-9]+$/)
      )) ||
    (typeof transaction.clientTxId === 'string' &&
      !transaction.metadata?.source &&
      !transaction.clientTxId.startsWith('direct_deposit_') &&
      transaction.clientTxId.includes(`${transaction.type}-`))
  );
}

/**
 * Deduplicate transactions based on hash/userOpHash
 * Priority: BRIDGE_DEPOSIT > CARD_TRANSACTION > SEND for card deposits
 * For other transactions, keep the one with the most complete data
 */
export function deduplicateTransactions(transactions: ActivityEvent[]): ActivityEvent[] {
  const deduplicated = new Map<string, ActivityEvent>();
  for (const transaction of transactions) {
    const key = getDedupKey(transaction);
    const currentIsCardDeposit = isCardDeposit(transaction);

    if (!key) {
      // No key available, add as-is (will be unique by clientTxId in keyExtractor)
      deduplicated.set(transaction.clientTxId || `no-key-${Math.random()}`, transaction);
      continue;
    }

    // Check if this transaction duplicates any existing one
    let existing: ActivityEvent | undefined;
    let existingKey: string | undefined;

    // First check if key already exists (fast path)
    if (deduplicated.has(key)) {
      existing = deduplicated.get(key);
      existingKey = key;
    } else {
      // Otherwise check all entries for duplicates (slower path)
      for (const [mapKey, mapValue] of deduplicated.entries()) {
        if (isDuplicate(transaction, mapValue)) {
          existing = mapValue;
          existingKey = mapKey;
          break;
        }
      }
    }

    if (!existing) {
      deduplicated.set(key, transaction);
      existing = transaction;
    }

    // Check if either transaction is a card deposit
    const existingIsCardDeposit = isCardDeposit(existing);
    // Check if they share the same toAddress (card funding address)
    // If so, treat SEND as a card deposit and prioritize BRIDGE_DEPOSIT/CARD_TRANSACTION
    const sameCardAddress =
      transaction.toAddress &&
      existing.toAddress &&
      transaction.toAddress.toLowerCase() === existing.toAddress.toLowerCase() &&
      Math.abs(parseInt(transaction.timestamp || '0') - parseInt(existing.timestamp || '0')) < 300; // Within 5 minutes

    // If both are card deposits or share same card address, prioritize by type
    if (currentIsCardDeposit || existingIsCardDeposit || sameCardAddress) {
      const typePriority = {
        [TransactionType.BRIDGE_DEPOSIT]: 3,
        [TransactionType.CARD_TRANSACTION]: 2,
        [TransactionType.SEND]: 1,
      };

      const currentPriority = typePriority[transaction.type as keyof typeof typePriority] || 0;
      const existingPriority = typePriority[existing.type as keyof typeof typePriority] || 0;

      if (currentPriority > existingPriority) {
        deduplicated.delete(existingKey!);
        deduplicated.set(key, transaction);
        continue;
      }
      if (currentPriority < existingPriority) {
        continue;
      }
      // If priorities are equal, fall through to general deduplication logic
    }

    // For other duplicates, prefer the one with:
    // 1. More complete data (has hash over just userOpHash)
    // 2. Status from backend over analytics (analytics have clientTxId like "TYPE-timestamp" or "TYPE-hash")
    // 3. More recent timestamp
    const currentHasHash = !!transaction.hash;
    const existingHasHash = !!existing.hash;

    if (currentHasHash && !existingHasHash) {
      deduplicated.delete(existingKey!);
      deduplicated.set(key, transaction);
    } else if (!currentHasHash && existingHasHash) {
      // Keep existing
    } else {
      // Both have same hash status, prefer backend status over analytics
      const currentIsAnalytics = isAnalyticsTransaction(transaction);
      const existingIsAnalytics = isAnalyticsTransaction(existing);

      const currentIsFrontend = transaction.metadata?.source === 'transaction-hook';
      const existingIsFrontend = existing.metadata?.source === 'transaction-hook';

      // Priority: Backend > Frontend-created > Analytics
      // (Backend has most reliable status, frontend-created is user-initiated, analytics can be inconsistent)
      if (
        !currentIsAnalytics &&
        !currentIsFrontend &&
        (existingIsAnalytics || existingIsFrontend)
      ) {
        // Current is backend, existing is not - prefer current
        deduplicated.delete(existingKey!);
        deduplicated.set(key, transaction);
      } else if (
        (currentIsAnalytics || currentIsFrontend) &&
        !existingIsAnalytics &&
        !existingIsFrontend
      ) {
        // Current is not backend, existing is backend - keep existing
      } else if (currentIsFrontend && existingIsAnalytics) {
        // Current is frontend-created, existing is analytics - prefer current
        deduplicated.delete(existingKey!);
        deduplicated.set(key, transaction);
      } else if (currentIsAnalytics && existingIsFrontend) {
        // Current is analytics, existing is frontend-created - keep existing
      } else {
        // Both from same source category, prefer more recent
        const currentTime = parseInt(transaction.timestamp || '0');
        const existingTime = parseInt(existing.timestamp || '0');
        if (currentTime > existingTime) {
          deduplicated.delete(existingKey!);
          deduplicated.set(key, transaction);
        }
      }
    }
  }

  let deduplicatedArray = Array.from(deduplicated.values());

  // Second pass: Remove SEND transactions that have a corresponding BRIDGE_DEPOSIT or CARD_TRANSACTION
  // with the same toAddress (card funding address) and similar timestamp
  deduplicatedArray = deduplicatedArray.filter(transaction => {
    // Keep all non-SEND transactions
    if (transaction.type !== TransactionType.SEND) return true;

    // For SEND transactions, check if there's a BRIDGE_DEPOSIT or CARD_TRANSACTION with same toAddress
    const hasCardDepositTransaction = deduplicatedArray.some(
      tx =>
        tx !== transaction &&
        (tx.type === TransactionType.BRIDGE_DEPOSIT ||
          tx.type === TransactionType.CARD_TRANSACTION) &&
        tx.toAddress?.toLowerCase() === transaction.toAddress?.toLowerCase() &&
        Math.abs(parseInt(tx.timestamp || '0') - parseInt(transaction.timestamp || '0')) < 300, // Within 5 minutes
    );

    // Remove SEND if there's a corresponding card deposit transaction
    return !hasCardDepositTransaction;
  });

  return deduplicatedArray;
}
