import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ArticleList,
  ChatCta,
  helpCollectionHref,
  HelpHeader,
  SectionTitle,
} from '@/components/Help/HelpParts';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useHelpCollection } from '@/hooks/useHelp';
import { isHelpRedirect } from '@/lib/api/help';

/** One collection: its articles, and the collections inside it. */
export default function HelpCollectionScreen() {
  const router = useRouter();
  const { slug: raw } = useLocalSearchParams<{ slug: string }>();
  const slug = String(raw ?? '').toLowerCase();
  const { isScreenMedium } = useDimension();
  const { data, isLoading, isError, refetch, isRefetching } = useHelpCollection(slug);
  const redirect = isHelpRedirect(data) ? data.redirectTo : null;

  useEffect(() => {
    if (redirect) router.replace(helpCollectionHref(redirect));
  }, [redirect, router]);

  const page = data && !isHelpRedirect(data) ? data : null;
  const title = page?.collection.name ?? 'Help Center';

  return (
    <PageLayout
      customMobileHeader={<HelpHeader title={title} fallbackHref={path.HELP as string} />}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      <View className="mx-auto w-full max-w-2xl px-4 pb-10">
        {isScreenMedium && <HelpHeader title={title} fallbackHref={path.HELP as string} />}
        {!page ? (
          isLoading || redirect ? (
            <ActivityIndicator className="mt-10" color="#FFFFFF" />
          ) : (
            <View className="mt-10 items-center gap-3">
              <Text className="text-white/70">
                {isError ? "This collection didn't load." : 'Nothing here.'}
              </Text>
              <Pressable
                onPress={() => router.replace(path.HELP)}
                className="rounded-full bg-white/10 px-4 py-2"
              >
                <Text className="text-white">Go to the Help Center</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            {page.parent && (
              <Pressable onPress={() => router.push(helpCollectionHref(page.parent!.slug))}>
                <Text className="mt-2 text-sm text-white/50">{page.parent.name}</Text>
              </Pressable>
            )}
            <Text className="mt-1 text-[26px] font-semibold leading-8 text-white">
              {page.collection.name}
            </Text>
            {!!page.collection.description && (
              <Text className="mt-1 text-[15px] leading-6 text-white/60">
                {page.collection.description}
              </Text>
            )}
            {page.collection.articles.length > 0 && (
              <View className="mt-5">
                <ArticleList articles={page.collection.articles} />
              </View>
            )}
            {page.collection.children.map(child => (
              <View key={child.slug}>
                <Pressable onPress={() => router.push(helpCollectionHref(child.slug))}>
                  <SectionTitle>{child.name}</SectionTitle>
                </Pressable>
                <ArticleList articles={child.articles} />
              </View>
            ))}
          </>
        )}
        <ChatCta />
      </View>
    </PageLayout>
  );
}
