import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export const infoClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.EXPO_PUBLIC_INFO_GRAPH }),
  cache: new InMemoryCache(),
});

export const algebraInfoClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.EXPO_PUBLIC_ALGEBRA_INFO_GRAPH }),
  cache: new InMemoryCache(),
});
