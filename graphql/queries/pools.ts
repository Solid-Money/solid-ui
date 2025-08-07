import { gql } from '@apollo/client';

import { algebraInfoClient } from '@/graphql/clients';

export const POOL_FRAGMENT = gql`
    fragment PoolFields on Pool {
        id
        fee
        token0 {
            ...TokenFields
        }
        token1 {
            ...TokenFields
        }
        sqrtPrice
        liquidity
        tick
        tickSpacing
        totalValueLockedUSD
        volumeUSD
        feesUSD
        untrackedFeesUSD
        token0Price
        token1Price
        createdAtTimestamp
    }
`;

export const TICK_FRAGMENT = gql`
    fragment TickFields on Tick {
        tickIdx
        liquidityNet
        liquidityGross
        price0
        price1
    }
`;

export const POOL_FEE_DATA_FRAGMENT = gql`
    fragment PoolFeeDataFields on PoolDayData {
        feesUSD
    }
`;

export const POOL_DAY_DATA_FRAGMENT = gql`
    fragment PoolDayDataFields on PoolDayData {
        feesUSD
        tvlUSD
        volumeUSD
        id
        date
    }
`;

export const POOLS_LIST = gql`
    query PoolsList {
        pools {
            ...PoolFields
            poolDayData(first: 7, orderBy: date, orderDirection: desc) {
                ...PoolDayDataFields
            }
        }
    }
`;

export const ALL_TICKS = gql`
    query allTicks($poolAddress: String!, $skip: Int!) {
        ticks(first: 1000, skip: $skip, where: { poolAddress: $poolAddress }, orderBy: tickIdx) {
            ...TickFields
        }
    }
`;

export const SINGLE_POOL = gql`
    query SinglePool($poolId: ID!) {
        pool(id: $poolId) {
            ...PoolFields
        }
    }
`;

export const MULTIPLE_POOLS = gql`
    query MultiplePools($poolIds: [ID!]) {
        pools(where: { id_in: $poolIds }) {
            ...PoolFields
        }
    }
`;

export const POOL_FEE_DATA = gql`
    query PoolFeeData($poolId: String) {
        poolDayDatas(where: { pool: $poolId }, orderBy: date, orderDirection: desc) {
            ...PoolFeeDataFields
        }
    }
`;

export const POOL_POSITIONS_BY_POOL_ID = gql`
    query PoolPositionsById($positionIds: [ID!], $skip: Int) {
        positions(where: { id_in: $positionIds }, first: 1000, skip: $skip) {
            id
            liquidity
            tickLower {
                tickIdx
            }
            tickUpper {
                tickIdx
            }
            pool {
                token0 {
                    name
                    decimals
                    derivedMatic
                }
                token1 {
                    name
                    decimals
                    derivedMatic
                }
                tick
            }
        }
    }
`;

// export const POOLS_DAY_DATAS = gql`
//     query PoolsVolumeData {
//         poolDayDatas(orderBy: date, orderDirection: desc) {
//             date
//             pool {
//                 id
//             }
//             volumeUSD
//             ...PoolDayDataFields
//         }
//     }
// `;

export async function getPoolPositionsByPoolPositionIdArray(positionIdArray: (string | number)[], skip: number) {
    const positionIds = positionIdArray.map(String);

    const response = await algebraInfoClient.query({
        query: POOL_POSITIONS_BY_POOL_ID,
        variables: { positionIds, skip },
        fetchPolicy: 'no-cache',
    });
    return response.data.positions;
}
