import { gql } from '@apollo/client';

import { infoClient } from '@/graphql/clients';

export const GET_ALGEBRA_PAIRS_QUERY = gql`
    query algebraPairs($from: Int!) {
        pools {
            id
            fee
            totalValueLockedUSD
            volumeUSD
            token0Price
            token1Price

            token0 {
                name
                symbol
                id
                derivedMatic
                decimals
            }

            token1 {
                name
                symbol
                id
                derivedMatic
                decimals
            }

            poolDayData(orderBy: date, orderDirection: desc, first: 365, where: { date_gte: $from }) {
                id
                date
                volumeUSD
                tvlUSD
                token0Price
                token1Price
            }
        }
    }
`;

export const POOLS_CHART_QUERY = gql`
    query pools {
        pools {
            id
            token0 {
                id
                symbol
            }
            token1 {
                id
                symbol
            }
            fee
            poolDayData(orderBy: date, orderDirection: asc, first: 365) {
                date
                volumeUSD
                tvlUSD
            }
        }
    }
`;

export const TOP_PAIRS_QUERY = gql`
    query topPairs {
        pools {
            id

            token0 {
                id
                symbol
            }

            token1 {
                id
                symbol
            }

            fee
            totalValueLockedUSD
            volumeUSD
        }
    }
`;

export async function getAlgebraPairs(from: number, first: number) {
    const response = await infoClient.query({
        query: GET_ALGEBRA_PAIRS_QUERY,
        variables: {
            from,
            first,
        },
    });

    return response.data.pools;
}
