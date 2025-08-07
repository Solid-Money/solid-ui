import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    overwrite: true,
    generates: {
        'src/graphql/generated/fuseInfo.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/7mTMzJM4W2a1sVkwYLYmMGnR2D3BLAhUxVKaqaxTRVQb', // https://thegraph.com/explorer/subgraphs/33j1AeUbvSvuKtgubvMLrSC8qGJKc3QzngM1PoLGLLb8?view=Query&chain=arbitrum-one
            documents: [
                'src/graphql/queries/algebraInfoSubgraph.ts',
                'src/graphql/queries/pools.ts',
                'src/graphql/queries/tokens.ts',
                'src/graphql/queries/global.ts',
            ],
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/blocks.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/4NdGNtBYVAuWriUfcb58vLmiaendp7v8EQ9tGe3i1RPo',
            documents: ['src/graphql/queries/blockSubgraph.ts', 'src/graphql/queries/blocks.ts'],
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/fuseFarming.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/6Wj8Aw9BgGFvciHA1i2gMYofgCCTn1RwUAW8AeZBtmPh',
            documents: ['src/graphql/queries/farmings.ts'],
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/pegswap.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/2awYxnhBXXQwUQG15pZY6K53oPGUSUEVLdB9UJF55cyy',
            documents: 'src/graphql/queries/pegswapSubgraph.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/liquidStaking.tsx': {
            schema: 'https://gateway-arbitrum.network.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/7FQVAoYfsrYPAVzaHnky1rHGYjXj2hcw3yokeLQmpntp',
            documents: 'src/graphql/queries/fuseLiquidStakingSubgraph.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/veVolt.tsx': {
            schema: 'https://gateway-arbitrum.network.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/5D1zpRupU7paCuSARLpbkmmi5ywpb6tbhdZWZpMFs7pD',
            documents: 'src/graphql/queries/veVoltSubgraph.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/fusd.tsx': {
            schema: 'https://gateway-arbitrum.network.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/5UhPGFCBafFdX2GJt5NbKDy5ognQgETFHN6nUonyqki2',
            documents: 'src/graphql/queries/fusdSubgraph.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/fusdV3.tsx': {
            schema: 'https://gateway-arbitrum.network.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/6CtoTUig1ej3i24WGmJ5o9N6CL9JWB3FUjsF5C1SRjFy',
            documents: 'src/graphql/queries/fusdV3Subgraph.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/voltMaker3.tsx': {
            schema: 'https://gateway-arbitrum.network.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/3359CPr9JVkQWzFGbkn9X79BEtmk9xySL6TaZpsRcVCX',
            documents: 'src/graphql/queries/voltMaker3.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/masterchefV3.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/4DwVLaAaEuutpoCwmGUNBS45mSnGABt42u1Qbf73BqbR', // https://thegraph.com/explorer/subgraphs/4DwVLaAaEuutpoCwmGUNBS45mSnGABt42u1Qbf73BqbR
            documents: 'src/graphql/queries/masterchefV3.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
        'src/graphql/generated/simpleStakingChef.tsx': {
            schema: 'https://gateway.thegraph.com/api/550967d6d70d7fce0a710f38dc7bc5df/subgraphs/id/9co6azYbeUZeW2EfKideZbjR77udKpo8Vz9aisdGnJyx',
            documents: 'src/graphql/queries/simpleStakingChef.ts',
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        },
    },
    ignoreNoDocuments: true,
};

export default config;
