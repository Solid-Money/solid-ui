import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import {
  ArticleList,
  ChatCta,
  helpCollectionHref,
  HelpHeader,
  HelpSearchField,
  SectionTitle,
} from '@/components/Help/HelpParts';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useHelpHome, useHelpSearch } from '@/hooks/useHelp';

const SearchResults = ({ query }: { query: string }) => {
  const { data, isFetching, isError } = useHelpSearch(query);
  if (query.trim().length < 2) return null;
  if (!data && isFetching) {
    return <ActivityIndicator className="mt-8" color="#FFFFFF" />;
  }
  if (isError && !data) {
    return (
      <Text className="mt-6 text-center text-white/60">Search isn&apos;t available right now.</Text>
    );
  }
  if (!data?.length) {
    return (
      <View className="mt-6 items-center gap-1 px-6">
        <Text className="text-center text-white">No articles match “{query.trim()}”.</Text>
        <Text className="text-center text-sm text-white/50">
          Try fewer or different words, or chat with us.
        </Text>
      </View>
    );
  }
  return (
    <>
      <SectionTitle>
        {data.length} result{data.length === 1 ? '' : 's'}
      </SectionTitle>
      <ArticleList articles={data} snippet />
    </>
  );
};

/** The help center in the app: search, collections, and the chat when nothing answers. */
export default function HelpHomeScreen() {
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const [query, setQuery] = useState('');
  const { data: home, isLoading, isError, refetch, isRefetching } = useHelpHome();
  const searching = query.trim().length >= 2;

  return (
    <PageLayout
      customMobileHeader={<HelpHeader title="Help Center" />}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      <View className="mx-auto w-full max-w-2xl px-4 pb-10">
        {isScreenMedium && <HelpHeader title="Help Center" />}
        <Text className="mb-4 mt-2 text-[28px] font-semibold leading-9 text-white">
          How can we help?
        </Text>
        <HelpSearchField value={query} onChange={setQuery} />

        {searching ? (
          <SearchResults query={query} />
        ) : isLoading && !home ? (
          <ActivityIndicator className="mt-10" color="#FFFFFF" />
        ) : isError && !home ? (
          <View className="mt-10 items-center gap-3">
            <Text className="text-white/70">The help center didn&apos;t load.</Text>
            <Pressable
              onPress={() => void refetch()}
              className="rounded-full bg-white/10 px-4 py-2"
            >
              <Text className="text-white">Try again</Text>
            </Pressable>
          </View>
        ) : home ? (
          <>
            <SectionTitle>Browse</SectionTitle>
            <View className="overflow-hidden rounded-2xl bg-card">
              {home.collections.map((collection, index) => (
                <Pressable
                  key={collection.slug}
                  accessibilityRole="button"
                  onPress={() => router.push(helpCollectionHref(collection.slug))}
                  className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 web:hover:bg-white/5 ${index > 0 ? 'border-t border-white/5' : ''}`}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-semibold text-white">{collection.name}</Text>
                    {!!collection.description && (
                      <Text className="text-[13px] leading-5 text-white/50" numberOfLines={2}>
                        {collection.description}
                      </Text>
                    )}
                    <Text className="mt-0.5 text-xs text-white/40">
                      {collection.articleCount} article{collection.articleCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                </Pressable>
              ))}
            </View>
            {home.otherArticles.length > 0 && (
              <>
                <SectionTitle>More articles</SectionTitle>
                <ArticleList articles={home.otherArticles} />
              </>
            )}
          </>
        ) : null}

        <ChatCta />
      </View>
    </PageLayout>
  );
}
