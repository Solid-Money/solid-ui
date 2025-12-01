import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  generates: {
    'graphql/generated/user-info.tsx': {
      schema: 'https://gateway.thegraph.com/api/3a78a20e9f74b2cecd6a4f0fc41bcafe/subgraphs/id/4aYLWHVUj975bLeY4zR32YgY4zxnJuEjJbT99eu2wyVd',
      documents: ['graphql/queries/user-info.ts', 'graphql/queries/exchangeRate.ts'],
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    },
    'graphql/generated/algebra-info.tsx': {
      schema: 'https://gateway.thegraph.com/api/3a78a20e9f74b2cecd6a4f0fc41bcafe/subgraphs/id/7mTMzJM4W2a1sVkwYLYmMGnR2D3BLAhUxVKaqaxTRVQb',
      documents: [
        'graphql/queries/algebraInfo.ts',
        'graphql/queries/pools.ts',
        'graphql/queries/tokens.ts',
        'graphql/queries/global.ts',
      ],
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    },
  },
  ignoreNoDocuments: true,
};

export default config;
