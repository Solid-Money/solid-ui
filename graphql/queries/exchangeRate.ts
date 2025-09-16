import { gql } from '@apollo/client';

export const GET_EXCHANGE_RATE_UPDATES_QUERY = gql`
  query GetExchangeRateUpdates($minTimestamp: BigInt!, $maxTimestamp: BigInt!) {
    exchangeRateUpdates(
      where: { timestamp_gte: $minTimestamp, timestamp_lte: $maxTimestamp }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      exchangeRate
    }
  }
`;
