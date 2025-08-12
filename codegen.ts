import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  generates: {
    'graphql/generated/user-info.tsx': {
      schema: 'https://api.studio.thegraph.com/query/78455/solid-frontend-production/v0.0.2',
      documents: ['graphql/queries/user-info.ts'],
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    },
    'graphql/generated/algebra-info.tsx': {
      schema: 'https://api.studio.thegraph.com/query/78455/algebra/version/latest',
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
