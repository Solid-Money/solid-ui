import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';
import { Paperclip, Sparkles } from 'lucide-react-native';

import Markdown from '@/components/Markdown';
import MessageAttachments from '@/components/Support/MessageAttachments';
import { Text } from '@/components/ui/text';
import { discardMessage, retryMessage } from '@/lib/support/sync';
import { contextLabel, PendingMessage } from '@/lib/support/threadState';
import { cn } from '@/lib/utils';

import type { SupportMessage } from '@/lib/types/support';

/** One row of the chat list. */
export type ChatRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: SupportMessage; first: boolean; last: boolean }
  | { type: 'pending'; key: string; entry: PendingMessage };

export const dayLabel = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE d MMM');
};

const sameAuthor = (a: SupportMessage, b: SupportMessage) =>
  a.author.type === b.author.type && a.author.name === b.author.name;

/** Messages and pending sends as list rows: day separators, and runs by the same author grouped. */
export function buildRows(messages: SupportMessage[], pending: PendingMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '';
  messages.forEach((message, index) => {
    const day = dayLabel(message.createdAt);
    if (day !== lastDay) {
      rows.push({ type: 'day', key: `day-${message.id}`, label: day });
      lastDay = day;
    }
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const first =
      !previous || !sameAuthor(previous, message) || dayLabel(previous.createdAt) !== day;
    const last = !next || !sameAuthor(next, message) || dayLabel(next.createdAt) !== day;
    rows.push({ type: 'message', key: message.id, message, first, last });
  });
  for (const entry of pending)
    rows.push({ type: 'pending', key: `pending-${entry.clientMessageId}`, entry });
  return rows;
}

const AuthorLabel = ({ message }: { message: SupportMessage }) => {
  if (message.author.type === 'ai') {
    return (
      <View className="mb-1 flex-row items-center gap-1 self-start rounded-full bg-white/10 px-2 py-0.5">
        <Sparkles size={12} color="#FFFFFF" />
        <Text className="text-xs font-medium text-white">Solid AI</Text>
      </View>
    );
  }
  return (
    <Text className="mb-1 text-xs font-medium text-white/60">
      {message.author.name ?? 'Solid Support'}
    </Text>
  );
};

const UserBubble = ({ message, last }: { message: SupportMessage; last: boolean }) => (
  <View className={cn('max-w-[85%] self-end', last ? 'mb-3' : 'mb-1')}>
    {message.context && (
      <Text className="mb-1 self-end text-xs text-white/50">
        About: {contextLabel(message.context.kind)}
      </Text>
    )}
    <View className="gap-2 rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5">
      <MessageAttachments message={message} />
      {message.redacted ? (
        <Text className="text-[15px] italic text-brand-foreground/70">
          This message was removed
        </Text>
      ) : message.body ? (
        <Text selectable className="text-[15px] leading-5 text-brand-foreground">
          {message.body}
        </Text>
      ) : null}
    </View>
    {last && (
      <Text className="mt-1 self-end text-[11px] text-white/40">
        {format(new Date(message.createdAt), 'h:mm a')}
      </Text>
    )}
  </View>
);

const ReplyBubble = ({
  message,
  first,
  last,
}: {
  message: SupportMessage;
  first: boolean;
  last: boolean;
}) => (
  <View className={cn('max-w-[85%] self-start', last ? 'mb-3' : 'mb-1')}>
    {first && <AuthorLabel message={message} />}
    <View className="gap-2 rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5">
      <MessageAttachments message={message} />
      {message.redacted ? (
        <Text className="text-[15px] italic text-white/60">This message was removed</Text>
      ) : message.body ? (
        <Markdown value={message.body} textColor="#FFFFFF" />
      ) : null}
    </View>
    {last && (
      <Text className="mt-1 text-[11px] text-white/40">
        {format(new Date(message.createdAt), 'h:mm a')}
      </Text>
    )}
  </View>
);

const SystemLine = ({ message }: { message: SupportMessage }) => (
  <View className="my-2 items-center px-6">
    <Text className="text-center text-xs text-white/50">{message.body}</Text>
  </View>
);

const PendingBubble = ({ entry }: { entry: PendingMessage }) => {
  const failed = entry.status === 'failed';
  return (
    <View className="mb-3 max-w-[85%] self-end">
      <Pressable
        disabled={!failed}
        onPress={() => retryMessage(entry.clientMessageId)}
        accessibilityRole={failed ? 'button' : undefined}
        accessibilityLabel={failed ? 'Retry sending' : undefined}
        className={cn(
          'gap-1 rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5',
          failed ? 'opacity-60' : 'opacity-70',
        )}
      >
        {entry.attachmentNames.map((name, index) => (
          <View key={`${index}-${name}`} className="flex-row items-center gap-1.5">
            <Paperclip size={12} color="#196B07" />
            <Text numberOfLines={1} className="shrink text-sm text-brand-foreground/80">
              {name}
            </Text>
          </View>
        ))}
        {!!entry.body && (
          <Text className="text-[15px] leading-5 text-brand-foreground">{entry.body}</Text>
        )}
      </Pressable>
      {failed ? (
        <View className="mt-1 flex-row items-center justify-end gap-3">
          <Text className="shrink text-right text-[11px] text-destructive">
            {entry.error ?? 'Not sent'}
          </Text>
          <Pressable onPress={() => retryMessage(entry.clientMessageId)} accessibilityRole="button">
            <Text className="text-[11px] font-semibold text-white">Retry</Text>
          </Pressable>
          <Pressable
            onPress={() => discardMessage(entry.clientMessageId)}
            accessibilityRole="button"
          >
            <Text className="text-[11px] text-white/60">Delete</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="mt-1 self-end text-[11px] text-white/40">Sending…</Text>
      )}
    </View>
  );
};

const MessageRow = ({ row }: { row: ChatRow }) => {
  if (row.type === 'day') {
    return (
      <View className="my-3 items-center">
        <Text className="text-xs font-medium text-white/40">{row.label}</Text>
      </View>
    );
  }
  if (row.type === 'pending') return <PendingBubble entry={row.entry} />;
  const { message } = row;
  if (message.author.type === 'system') return <SystemLine message={message} />;
  if (message.author.type === 'user') return <UserBubble message={message} last={row.last} />;
  return <ReplyBubble message={message} first={row.first} last={row.last} />;
};

export default memo(MessageRow);
