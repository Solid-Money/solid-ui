import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { ArrowUp, FileText, ShieldAlert, X } from 'lucide-react-native';

import AttachButton, { attachAvailable } from '@/components/Support/AttachButton';
import { Text } from '@/components/ui/text';
import {
  ACCEPTED_MIME,
  MAX_ATTACHMENTS,
  MAX_BODY_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
} from '@/lib/support/sync';
import { containsCardNumber } from '@/lib/support/threadState';
import { cn } from '@/lib/utils';

import type { SupportFile } from '@/lib/types/support';

interface ComposerProps {
  onSend: (body: string, files: SupportFile[]) => void;
  bottomInset: number;
}

/** Why a picked file cannot be sent, or null when it can. */
export const fileProblem = (file: SupportFile): string | null => {
  if (!ACCEPTED_MIME.includes(file.mime))
    return `${file.name}: only photos and PDFs can be attached`;
  const limit = file.mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size !== undefined && file.size > limit) {
    return `${file.name} is over ${Math.round(limit / (1024 * 1024))} MB`;
  }
  return null;
};

/** The input grows with the text up to this height, then scrolls. */
const MAX_INPUT_HEIGHT = 128;
// The web's textarea defaults to two rows; one row, then it grows (below).
const webRows = Platform.OS === 'web' ? ({ rows: 1 } as object) : {};

const Composer = ({ onSend, bottomInset }: ComposerProps) => {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<SupportFile[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const cardWarning = useMemo(() => containsCardNumber(body), [body]);
  const canSend = (body.trim().length > 0 || files.length > 0) && body.length <= MAX_BODY_LENGTH;

  const send = useCallback(() => {
    if (!canSend) return;
    onSend(body, files);
    setBody('');
    setFiles([]);
    setProblem(null);
  }, [body, canSend, files, onSend]);

  const pick = useCallback(
    (picked: SupportFile[], left = 0) => {
      const problems = picked.map(fileProblem).filter(Boolean) as string[];
      const usable = picked.filter(file => !fileProblem(file));
      const room = MAX_ATTACHMENTS - files.length;
      if (usable.length > room || left > 0) {
        problems.push(`Up to ${MAX_ATTACHMENTS} files per message`);
      }
      setFiles(current => [...current, ...usable.slice(0, Math.max(0, room))]);
      setProblem(problems[0] ?? null);
    },
    [files.length],
  );

  // Native inputs grow on their own; on the web, fit the textarea to its text.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [body]);

  // The web sends on Enter and keeps Shift+Enter for a new line.
  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== 'web') return;
      const native = event.nativeEvent as TextInputKeyPressEventData & {
        shiftKey?: boolean;
        isComposing?: boolean;
      };
      if (native.key === 'Enter' && !native.shiftKey && !native.isComposing) {
        event.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <View className="bg-background px-3 pt-2" style={{ paddingBottom: bottomInset + 10 }}>
      {cardWarning && (
        <View className="mb-2 flex-row items-start gap-2 rounded-xl bg-warning/15 px-3 py-2">
          <ShieldAlert size={16} color="#FFC852" />
          <Text className="flex-1 text-xs leading-4 text-warning">
            That looks like a card number. Never share your full card number or CVV. We will never
            ask for them.
          </Text>
        </View>
      )}
      {!!problem && <Text className="mb-2 text-xs text-destructive">{problem}</Text>}
      {files.length > 0 && (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {files.map((file, index) => (
            <View
              key={`${index}-${file.name}`}
              className="flex-row items-center gap-1.5 rounded-full bg-card py-1 pl-2.5 pr-1"
            >
              <FileText size={14} color="#A1A1A1" />
              <Text numberOfLines={1} className="max-w-[160px] text-xs text-white">
                {file.name}
              </Text>
              <Pressable
                onPress={() => setFiles(current => current.filter((_, at) => at !== index))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${file.name}`}
                className="h-6 w-6 items-center justify-center rounded-full"
              >
                <X size={14} color="#A1A1A1" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View
        className={cn(
          'flex-row items-end rounded-[22px] border bg-card p-1',
          focused ? 'border-white/25' : 'border-white/10',
        )}
      >
        <AttachButton
          disabled={files.length >= MAX_ATTACHMENTS}
          room={MAX_ATTACHMENTS - files.length}
          onPick={pick}
        />
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={setBody}
          onKeyPress={handleKeyPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Write a message"
          placeholderTextColor="#6B6B6B"
          multiline
          {...webRows}
          maxLength={MAX_BODY_LENGTH}
          accessibilityLabel="Message"
          className={cn(
            'max-h-32 min-h-9 flex-1 bg-transparent py-2 text-[15px] leading-5 text-white web:resize-none web:outline-none',
            attachAvailable ? 'px-1.5' : 'px-3',
          )}
          textAlignVertical="center"
        />
        <Pressable
          disabled={!canSend}
          onPress={send}
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={cn(
            'h-9 w-9 items-center justify-center rounded-full',
            canSend ? 'bg-brand active:opacity-80 web:hover:bg-brand-hover' : 'bg-white/5',
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} color={canSend ? '#196B07' : '#5A5A5A'} />
        </Pressable>
      </View>
    </View>
  );
};

export default memo(Composer);
