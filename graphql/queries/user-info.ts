import { gql } from '@apollo/client';

export const GET_USER_TRANSACTIONS_QUERY = gql`
  query GetUserTransactions($address: Bytes!) {
    deposits(where: { receiver: $address }) {
      depositor
      receiver
      depositAmount
      depositTimestamp
      isBridged
      shareAmount
      transactionHash
    }
    withdraws(where: { user_: { id: $address } }) {
      amountOfAssets
      amountOfShares
      creationTime
      requestTimestamp
      requestStatus
      requestTxHash
      solveTxHash
      requestId
    }
    bridges(where: { user: $address }) {
      user
      transactionHash
      shareAmount
      blockTimestamp
    }
  }
`;
