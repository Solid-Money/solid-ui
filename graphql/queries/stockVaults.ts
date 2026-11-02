import { gql, type TypedDocumentNode } from '@apollo/client';

import type { GetUserTransactionsQuery } from '@/graphql/generated/user-info';

/**
 * The stock vaults' subgraph (`EXPO_PUBLIC_INFO_GRAPH_STOCKS`) indexes all eight
 * vaults in one, with the soEUR subgraph's entities and fields plus `vault` on every
 * row: a relation to the `Vault` entity, whose id is the BoringVault's address
 * (`Bytes`, lowercase hex). It has no `bridges`, so GET_USER_TRANSACTIONS_QUERY
 * cannot be sent to it as it is. A query that filters by vault does it like the
 * user filter, `vault_: { id: $vault }` with `$vault: Bytes!`.
 *
 * Typed by hand rather than by codegen, which reads the USD subgraph's schema: the
 * fields are the generated ones, plus `vault`.
 */

type UserTransactions = Omit<GetUserTransactionsQuery, '__typename' | 'bridges'>;

/** A row's vault: its id is the BoringVault's address, lowercase. */
type StockVaultRef = { vault: { id: string } };

export type StockVaultDeposit = UserTransactions['deposits'][number] & StockVaultRef;

export type StockVaultWithdraw = UserTransactions['withdraws'][number] & StockVaultRef;

/** Whether a stocks subgraph row belongs to the vault at `vaultAddress`. */
export const isStockVaultRow = (row: Partial<StockVaultRef>, vaultAddress: string) =>
  row.vault?.id?.toLowerCase() === vaultAddress.toLowerCase();

export type StockVaultTransactions = {
  deposits: StockVaultDeposit[];
  withdraws: StockVaultWithdraw[];
};

/**
 * Every deposit and withdraw request of `address` across the eight stock vaults, in
 * one request: the activity list reads every vault's withdraws at once, and a vault's
 * own history picks its rows out by `vault { id }`.
 */
export const GET_STOCK_VAULT_TRANSACTIONS_QUERY: TypedDocumentNode<
  StockVaultTransactions,
  { address: string }
> = gql`
  query GetStockVaultTransactions($address: Bytes!) {
    deposits(where: { receiver: $address }) {
      vault {
        id
      }
      depositor
      receiver
      depositAmount
      depositTimestamp
      isBridged
      shareAmount
      transactionHash
    }
    withdraws(where: { user_: { id: $address } }) {
      vault {
        id
      }
      requestId
      amountOfAssets
      amountOfShares
      creationTime
      requestTimestamp
      requestStatus
      requestTxHash
      solveTxHash
    }
  }
`;
