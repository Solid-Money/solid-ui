import { ApolloClient, InMemoryCache } from '@apollo/client';

export const infoClient = new ApolloClient({
  uri: process.env.EXPO_PUBLIC_INFO_GRAPH,
  cache: new InMemoryCache(),
});

export const algebraInfoClient = new ApolloClient({
  uri: process.env.EXPO_PUBLIC_ALGEBRA_INFO_GRAPH,
  cache: new InMemoryCache(),
});
