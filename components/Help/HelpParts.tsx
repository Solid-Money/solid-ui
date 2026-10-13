import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { ChevronRight, MessageCircle, Search, ThumbsDown, ThumbsUp, X } from 'lucide-react-native';

import { BackButton } from '@/components/ui/back-button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { sendHelpFeedback } from '@/lib/api/help';
import { cn } from '@/lib/utils';
import { useHelpCacheStore } from '@/store/useHelpCacheStore';
import { useSupportChatStore } from '@/store/useSupportChatStore';

import type { HelpArticle, HelpArticleSummary } from '@/lib/types/help';

export const helpArticleHref = (slug: string) => `/help/articles/${slug}` as Href;
export const helpCollectionHref = (slug: string) => `/help/collections/${slug}` as Href;

export const HelpHeader = ({
  title,
  fallbackHref = '/',
}: {
  title: string;
  fallbackHref?: string;
}) => (
  <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
    <BackButton variant="header" fallbackHref={fallbackHref} />
    <Text className="flex-1 text-lg font-semibold text-white" numberOfLines={1}>
      {title}
    </Text>
  </View>
);

export const HelpSearchField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <View className="flex-row items-center gap-2 rounded-2xl bg-card px-4">
    <Search size={18} color="rgba(255,255,255,0.5)" />
    <Input
      value={value}
      onChangeText={onChange}
      placeholder="Search for answers"
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel="Search the help center"
      className="h-12 flex-1 border-0 bg-transparent px-0 text-base text-white"
    />
    {!!value && (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear search"
        hitSlop={8}
        onPress={() => onChange('')}
      >
        <X size={18} color="rgba(255,255,255,0.5)" />
      </Pressable>
    )}
  </View>
);

/** A list of articles in one rounded card, each row opening the article. */
export const ArticleList = ({
  articles,
  snippet,
}: {
  articles: (HelpArticleSummary & { snippet?: string })[];
  snippet?: boolean;
}) => {
  const router = useRouter();
  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      {articles.map((article, index) => (
        <Pressable
          key={article.id}
          accessibilityRole="button"
          onPress={() => router.push(helpArticleHref(article.slug))}
          className={cn(
            'flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 web:hover:bg-white/5',
            index > 0 && 'border-t border-white/5',
          )}
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-medium text-white">{article.title}</Text>
            {snippet && article.snippet ? (
              <Text className="text-[13px] leading-5 text-white/60" numberOfLines={2}>
                {article.snippet}
              </Text>
            ) : article.description ? (
              <Text className="text-[13px] leading-5 text-white/50" numberOfLines={2}>
                {article.description}
              </Text>
            ) : null}
            {snippet && article.collection && (
              <Text className="mt-0.5 text-xs text-white/40">{article.collection.name}</Text>
            )}
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
        </Pressable>
      ))}
    </View>
  );
};

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text className="mb-2 mt-6 px-1 text-sm font-medium uppercase tracking-wide text-white/50">
    {children}
  </Text>
);

/** Opens the chat, with the article attached when there is one. */
export const useChatAbout = () => {
  const router = useRouter();
  return (article?: Pick<HelpArticle, 'slug' | 'title'>) => {
    if (article) {
      useSupportChatStore
        .getState()
        .setDraftContext({ kind: 'help_article', id: article.slug, label: article.title });
    }
    router.push(path.SUPPORT);
  };
};

export const ChatCta = ({ article }: { article?: Pick<HelpArticle, 'slug' | 'title'> }) => {
  const chatAbout = useChatAbout();
  return (
    <View className="mt-8 flex-row items-center gap-3 rounded-2xl bg-card p-4">
      <View className="flex-1">
        <Text className="text-base font-semibold text-white">Still need help?</Text>
        <Text className="text-sm text-white/60">
          Chat with Solid support. We reply in your language.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => chatAbout(article)}
        className="flex-row items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 active:opacity-80"
      >
        <MessageCircle size={16} color="#0B3D06" />
        <Text className="font-semibold text-[#0B3D06]">Chat</Text>
      </Pressable>
    </View>
  );
};

/** "Did this answer your question?" One vote per article version; "No" offers the chat with the article attached. */
export const ArticleFeedback = ({ article }: { article: HelpArticle }) => {
  const saved = useHelpCacheStore(state => state.votes[article.versionId]);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const chatAbout = useChatAbout();

  const vote = async (helpful: boolean) => {
    setSending(true);
    setFailed(false);
    try {
      await sendHelpFeedback(article.id, article.versionId, helpful);
      useHelpCacheStore.getState().saveVote(article.versionId, helpful);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (saved === true) {
    return (
      <View className="mt-8 rounded-2xl bg-card p-4">
        <Text className="font-medium text-white">Thanks for letting us know.</Text>
      </View>
    );
  }
  if (saved === false) {
    return (
      <View className="mt-8 gap-3 rounded-2xl bg-card p-4">
        <View>
          <Text className="font-semibold text-white">
            Sorry this didn&apos;t answer your question.
          </Text>
          <Text className="text-sm text-white/60">
            Tell us what you were looking for and we&apos;ll help.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => chatAbout(article)}
          className="flex-row items-center justify-center gap-2 rounded-full bg-brand py-3 active:opacity-80"
        >
          <MessageCircle size={16} color="#0B3D06" />
          <Text className="font-semibold text-[#0B3D06]">Chat with us about this</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="mt-8 flex-row items-center gap-3 rounded-2xl bg-card p-4">
      <Text className="flex-1 font-medium text-white">
        {failed ? "Couldn't send that. Try again?" : 'Did this answer your question?'}
      </Text>
      {(
        [
          { helpful: true, label: 'Yes', Icon: ThumbsUp },
          { helpful: false, label: 'No', Icon: ThumbsDown },
        ] as const
      ).map(({ helpful, label, Icon }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={sending}
          onPress={() => void vote(helpful)}
          className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 active:opacity-70 web:hover:bg-white/15"
        >
          <Icon size={15} color="#FFFFFF" />
          <Text className="text-sm font-medium text-white">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
};
