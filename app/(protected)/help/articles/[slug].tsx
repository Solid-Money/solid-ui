import { useEffect } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react-native';

import HelpMarkdown from '@/components/Help/HelpMarkdown';
import {
  ArticleFeedback,
  ArticleList,
  ChatCta,
  helpArticleHref,
  helpCollectionHref,
  HelpHeader,
  SectionTitle,
} from '@/components/Help/HelpParts';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useHelpArticle } from '@/hooks/useHelp';
import { isHelpRedirect } from '@/lib/api/help';

/**
 * A help article, read natively. Opened from the help center, from links in
 * the app (old Intercom URLs included: the server answers with the current
 * slug), and from the sources under Solid AI's answers. Shown from the device
 * cache while it refreshes, so it also opens offline.
 */
export default function HelpArticleScreen() {
  const router = useRouter();
  const { slug: raw } = useLocalSearchParams<{ slug: string }>();
  const slug = String(raw ?? '').toLowerCase();
  const { isScreenMedium } = useDimension();
  const { data, isLoading, isError, refetch, isRefetching } = useHelpArticle(slug);
  const redirect = isHelpRedirect(data) ? data.redirectTo : null;

  useEffect(() => {
    if (redirect) router.replace(helpArticleHref(redirect));
  }, [redirect, router]);

  const article = data && !isHelpRedirect(data) ? data : null;
  const headerTitle = article?.collection?.name ?? 'Help Center';

  return (
    <PageLayout
      customMobileHeader={<HelpHeader title={headerTitle} fallbackHref={path.HELP as string} />}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      <View className="mx-auto w-full max-w-2xl px-4 pb-10">
        {isScreenMedium && <HelpHeader title={headerTitle} fallbackHref={path.HELP as string} />}
        {!article ? (
          isLoading || redirect ? (
            <ActivityIndicator className="mt-10" color="#FFFFFF" />
          ) : (
            <View className="mt-10 items-center gap-3">
              <Text className="text-center text-white/70">
                {isError
                  ? "This article didn't load. Check your connection."
                  : 'This article is no longer available.'}
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
            {article.collection && (
              <Pressable onPress={() => router.push(helpCollectionHref(article.collection!.slug))}>
                <Text className="mt-2 text-sm text-white/50">
                  {article.parent ? `${article.parent.name} › ` : ''}
                  {article.collection.name}
                </Text>
              </Pressable>
            )}
            <Text className="mt-1 text-[26px] font-semibold leading-8 text-white">
              {article.title}
            </Text>
            {!!article.description && (
              <Text className="mt-2 text-[16px] leading-6 text-white/60">
                {article.description}
              </Text>
            )}
            <Text className="mb-5 mt-2 text-xs text-white/40">
              Updated {format(new Date(article.updatedAt), 'MMMM d, yyyy')}
            </Text>
            <HelpMarkdown value={article.markdown} />
            <ArticleFeedback article={article} />
            {article.related.length > 0 && (
              <>
                <SectionTitle>Related articles</SectionTitle>
                <ArticleList articles={article.related} />
              </>
            )}
            {article.url && (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(article.url!).catch(() => undefined)}
                className="mt-6 flex-row items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} color="rgba(255,255,255,0.5)" />
                <Text className="text-sm text-white/50">Open on the web</Text>
              </Pressable>
            )}
            <ChatCta article={article} />
          </>
        )}
      </View>
    </PageLayout>
  );
}
