import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigDecimal: { input: any; output: any; }
  BigInt: { input: any; output: any; }
  Bytes: { input: any; output: any; }
  Int8: { input: any; output: any; }
  Timestamp: { input: any; output: any; }
};

export enum Aggregation_Interval {
  Day = 'day',
  Hour = 'hour'
}

export type BlockChangedFilter = {
  number_gte: Scalars['Int']['input'];
};

export type Block_Height = {
  hash?: InputMaybe<Scalars['Bytes']['input']>;
  number?: InputMaybe<Scalars['Int']['input']>;
  number_gte?: InputMaybe<Scalars['Int']['input']>;
};

export type Bridge = {
  __typename?: 'Bridge';
  blockNumber: Scalars['BigInt']['output'];
  blockTimestamp: Scalars['BigInt']['output'];
  id: Scalars['Bytes']['output'];
  shareAmount: Scalars['BigInt']['output'];
  transactionHash: Scalars['Bytes']['output'];
  user: Scalars['Bytes']['output'];
};

export type Bridge_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Bridge_Filter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['Bytes']['input']>;
  id_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_gt?: InputMaybe<Scalars['Bytes']['input']>;
  id_gte?: InputMaybe<Scalars['Bytes']['input']>;
  id_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id_lt?: InputMaybe<Scalars['Bytes']['input']>;
  id_lte?: InputMaybe<Scalars['Bytes']['input']>;
  id_not?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Bridge_Filter>>>;
  shareAmount?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  shareAmount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_not?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  transactionHash?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  transactionHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user?: InputMaybe<Scalars['Bytes']['input']>;
  user_contains?: InputMaybe<Scalars['Bytes']['input']>;
  user_gt?: InputMaybe<Scalars['Bytes']['input']>;
  user_gte?: InputMaybe<Scalars['Bytes']['input']>;
  user_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user_lt?: InputMaybe<Scalars['Bytes']['input']>;
  user_lte?: InputMaybe<Scalars['Bytes']['input']>;
  user_not?: InputMaybe<Scalars['Bytes']['input']>;
  user_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  user_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
};

export enum Bridge_OrderBy {
  BlockNumber = 'blockNumber',
  BlockTimestamp = 'blockTimestamp',
  Id = 'id',
  ShareAmount = 'shareAmount',
  TransactionHash = 'transactionHash',
  User = 'user'
}

export type Deposit = {
  __typename?: 'Deposit';
  blockNumber: Scalars['BigInt']['output'];
  blockTimestamp: Scalars['BigInt']['output'];
  depositAmount: Scalars['BigInt']['output'];
  depositAsset: Scalars['Bytes']['output'];
  depositTimestamp: Scalars['BigInt']['output'];
  depositor: Scalars['Bytes']['output'];
  id: Scalars['Bytes']['output'];
  isBridged: Scalars['Boolean']['output'];
  nonce: Scalars['BigInt']['output'];
  receiver: Scalars['Bytes']['output'];
  shareAmount: Scalars['BigInt']['output'];
  shareLockPeriodAtTimeOfDeposit: Scalars['BigInt']['output'];
  transactionHash: Scalars['Bytes']['output'];
};

export type Deposit_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Deposit_Filter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAmount?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAmount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositAmount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAsset?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_contains?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_gt?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_gte?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  depositAsset_lt?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_lte?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_not?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  depositAsset_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  depositTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositor?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_contains?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_gt?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_gte?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  depositor_lt?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_lte?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_not?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  depositor_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id?: InputMaybe<Scalars['Bytes']['input']>;
  id_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_gt?: InputMaybe<Scalars['Bytes']['input']>;
  id_gte?: InputMaybe<Scalars['Bytes']['input']>;
  id_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id_lt?: InputMaybe<Scalars['Bytes']['input']>;
  id_lte?: InputMaybe<Scalars['Bytes']['input']>;
  id_not?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  isBridged?: InputMaybe<Scalars['Boolean']['input']>;
  isBridged_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isBridged_not?: InputMaybe<Scalars['Boolean']['input']>;
  isBridged_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  nonce?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Deposit_Filter>>>;
  receiver?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_contains?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_gt?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_gte?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  receiver_lt?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_lte?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_not?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  receiver_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  shareAmount?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  shareAmount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_not?: InputMaybe<Scalars['BigInt']['input']>;
  shareAmount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  shareLockPeriodAtTimeOfDeposit?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  shareLockPeriodAtTimeOfDeposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  shareLockPeriodAtTimeOfDeposit_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  transactionHash?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  transactionHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
};

export enum Deposit_OrderBy {
  BlockNumber = 'blockNumber',
  BlockTimestamp = 'blockTimestamp',
  DepositAmount = 'depositAmount',
  DepositAsset = 'depositAsset',
  DepositTimestamp = 'depositTimestamp',
  Depositor = 'depositor',
  Id = 'id',
  IsBridged = 'isBridged',
  Nonce = 'nonce',
  Receiver = 'receiver',
  ShareAmount = 'shareAmount',
  ShareLockPeriodAtTimeOfDeposit = 'shareLockPeriodAtTimeOfDeposit',
  TransactionHash = 'transactionHash'
}

/** Defines the order direction, either ascending or descending */
export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type Query = {
  __typename?: 'Query';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  bridge?: Maybe<Bridge>;
  bridges: Array<Bridge>;
  deposit?: Maybe<Deposit>;
  deposits: Array<Deposit>;
  withdraw?: Maybe<Withdraw>;
  withdraws: Array<Withdraw>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryBridgeArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryBridgesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Bridge_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Bridge_Filter>;
};


export type QueryDepositArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryDepositsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Deposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Deposit_Filter>;
};


export type QueryWithdrawArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryWithdrawsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Withdraw_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Withdraw_Filter>;
};

export type Withdraw = {
  __typename?: 'Withdraw';
  amountOfAssets: Scalars['BigInt']['output'];
  amountOfShares: Scalars['BigInt']['output'];
  assetOut: Scalars['Bytes']['output'];
  creationTime: Scalars['BigInt']['output'];
  id: Scalars['Bytes']['output'];
  nonce: Scalars['BigInt']['output'];
  requestId: Scalars['Bytes']['output'];
  requestStatus: Scalars['String']['output'];
  requestTimestamp: Scalars['BigInt']['output'];
  requestTxHash: Scalars['Bytes']['output'];
  secondsToDeadline: Scalars['BigInt']['output'];
  secondsToMaturity: Scalars['BigInt']['output'];
  solveTimestamp: Scalars['BigInt']['output'];
  solveTxHash: Scalars['Bytes']['output'];
  user: Scalars['Bytes']['output'];
};

export type Withdraw_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  amountOfAssets?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amountOfAssets_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_not?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfAssets_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amountOfShares?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amountOfShares_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_not?: InputMaybe<Scalars['BigInt']['input']>;
  amountOfShares_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  and?: InputMaybe<Array<InputMaybe<Withdraw_Filter>>>;
  assetOut?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_contains?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_gt?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_gte?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  assetOut_lt?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_lte?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_not?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  assetOut_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  creationTime?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_gt?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_gte?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  creationTime_lt?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_lte?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_not?: InputMaybe<Scalars['BigInt']['input']>;
  creationTime_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['Bytes']['input']>;
  id_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_gt?: InputMaybe<Scalars['Bytes']['input']>;
  id_gte?: InputMaybe<Scalars['Bytes']['input']>;
  id_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id_lt?: InputMaybe<Scalars['Bytes']['input']>;
  id_lte?: InputMaybe<Scalars['Bytes']['input']>;
  id_not?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  nonce?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Withdraw_Filter>>>;
  requestId?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_contains?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_gt?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_gte?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  requestId_lt?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_lte?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_not?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  requestId_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  requestStatus?: InputMaybe<Scalars['String']['input']>;
  requestStatus_contains?: InputMaybe<Scalars['String']['input']>;
  requestStatus_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  requestStatus_ends_with?: InputMaybe<Scalars['String']['input']>;
  requestStatus_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  requestStatus_gt?: InputMaybe<Scalars['String']['input']>;
  requestStatus_gte?: InputMaybe<Scalars['String']['input']>;
  requestStatus_in?: InputMaybe<Array<Scalars['String']['input']>>;
  requestStatus_lt?: InputMaybe<Scalars['String']['input']>;
  requestStatus_lte?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_contains?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  requestStatus_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  requestStatus_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  requestStatus_starts_with?: InputMaybe<Scalars['String']['input']>;
  requestStatus_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  requestTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  requestTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  requestTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  requestTxHash?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  requestTxHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  requestTxHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  secondsToDeadline?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  secondsToDeadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToDeadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  secondsToMaturity?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_gt?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_gte?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  secondsToMaturity_lt?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_lte?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_not?: InputMaybe<Scalars['BigInt']['input']>;
  secondsToMaturity_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  solveTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  solveTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  solveTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  solveTxHash?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  solveTxHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  solveTxHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user?: InputMaybe<Scalars['Bytes']['input']>;
  user_contains?: InputMaybe<Scalars['Bytes']['input']>;
  user_gt?: InputMaybe<Scalars['Bytes']['input']>;
  user_gte?: InputMaybe<Scalars['Bytes']['input']>;
  user_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user_lt?: InputMaybe<Scalars['Bytes']['input']>;
  user_lte?: InputMaybe<Scalars['Bytes']['input']>;
  user_not?: InputMaybe<Scalars['Bytes']['input']>;
  user_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  user_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
};

export enum Withdraw_OrderBy {
  AmountOfAssets = 'amountOfAssets',
  AmountOfShares = 'amountOfShares',
  AssetOut = 'assetOut',
  CreationTime = 'creationTime',
  Id = 'id',
  Nonce = 'nonce',
  RequestId = 'requestId',
  RequestStatus = 'requestStatus',
  RequestTimestamp = 'requestTimestamp',
  RequestTxHash = 'requestTxHash',
  SecondsToDeadline = 'secondsToDeadline',
  SecondsToMaturity = 'secondsToMaturity',
  SolveTimestamp = 'solveTimestamp',
  SolveTxHash = 'solveTxHash',
  User = 'user'
}

export type _Block_ = {
  __typename?: '_Block_';
  /** The hash of the block */
  hash?: Maybe<Scalars['Bytes']['output']>;
  /** The block number */
  number: Scalars['Int']['output'];
  /** The hash of the parent block */
  parentHash?: Maybe<Scalars['Bytes']['output']>;
  /** Integer representation of the timestamp stored in blocks for the chain */
  timestamp?: Maybe<Scalars['Int']['output']>;
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  __typename?: '_Meta_';
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  block: _Block_;
  /** The deployment ID */
  deployment: Scalars['String']['output'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars['Boolean']['output'];
};

export enum _SubgraphErrorPolicy_ {
  /** Data will be returned even if the subgraph has indexing errors */
  Allow = 'allow',
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  Deny = 'deny'
}

export type GetUserTransactionsQueryVariables = Exact<{
  address: Scalars['Bytes']['input'];
}>;


export type GetUserTransactionsQuery = { __typename?: 'Query', deposits: Array<{ __typename?: 'Deposit', depositor: any, receiver: any, depositAmount: any, depositTimestamp: any, isBridged: boolean, shareAmount: any, transactionHash: any }>, withdraws: Array<{ __typename?: 'Withdraw', user: any, amountOfAssets: any, amountOfShares: any, creationTime: any, requestTimestamp: any, requestStatus: string, requestTxHash: any, solveTxHash: any, requestId: any }>, bridges: Array<{ __typename?: 'Bridge', user: any, transactionHash: any, shareAmount: any, blockTimestamp: any }> };


export const GetUserTransactionsDocument = gql`
    query GetUserTransactions($address: Bytes!) {
  deposits(where: {receiver: $address}) {
    depositor
    receiver
    depositAmount
    depositTimestamp
    isBridged
    shareAmount
    transactionHash
  }
  withdraws(where: {user: $address}) {
    user
    amountOfAssets
    amountOfShares
    creationTime
    requestTimestamp
    requestStatus
    requestTxHash
    solveTxHash
    requestId
  }
  bridges(where: {user: $address}) {
    user
    transactionHash
    shareAmount
    blockTimestamp
  }
}
    `;

/**
 * __useGetUserTransactionsQuery__
 *
 * To run a query within a React component, call `useGetUserTransactionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserTransactionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserTransactionsQuery({
 *   variables: {
 *      address: // value for 'address'
 *   },
 * });
 */
export function useGetUserTransactionsQuery(baseOptions: Apollo.QueryHookOptions<GetUserTransactionsQuery, GetUserTransactionsQueryVariables> & ({ variables: GetUserTransactionsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>(GetUserTransactionsDocument, options);
      }
export function useGetUserTransactionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>(GetUserTransactionsDocument, options);
        }
export function useGetUserTransactionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>(GetUserTransactionsDocument, options);
        }
export type GetUserTransactionsQueryHookResult = ReturnType<typeof useGetUserTransactionsQuery>;
export type GetUserTransactionsLazyQueryHookResult = ReturnType<typeof useGetUserTransactionsLazyQuery>;
export type GetUserTransactionsSuspenseQueryHookResult = ReturnType<typeof useGetUserTransactionsSuspenseQuery>;
export type GetUserTransactionsQueryResult = Apollo.QueryResult<GetUserTransactionsQuery, GetUserTransactionsQueryVariables>;