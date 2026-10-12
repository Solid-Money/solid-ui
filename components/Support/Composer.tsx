import { memo, useCallback, useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { ArrowUp, FileText, ShieldAlert, X } from 'lucide-react-native';

import AttachButton from '@/components/Support/AttachButton';
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

const Composer = ({ onSend, bottomInset }: ComposerProps) => {
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
    (picked: SupportFile[]) => {
      const problems = picked.map(fileProblem).filter(Boolean) as string[];
      const usable = picked.filter(file => !fileProblem(file));
      const room = MAX_ATTACHMENTS - files.length;
      if (usable.length > room) problems.push(`Up to ${MAX_ATTACHMENTS} files per message`);
      setFiles(current => [...current, ...usable.slice(0, Math.max(0, room))]);
      setProblem(problems[0] ?? null);
    },
    [files.length],
  );

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
    <View
      className="border-t border-white/10 bg-background px-3 pt-2"
      style={{ paddingBottom: bottomInset + 8 }}
    >
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
      <View className="flex-row items-end gap-1">
        <AttachButton disabled={files.length >= MAX_ATTACHMENTS} onPick={pick} />
        <TextInput
          value={body}
          onChangeText={setBody}
          onKeyPress={handleKeyPress}
          placeholder="Message"
          placeholderTextColor="#6B6B6B"
          multiline
          maxLength={MAX_BODY_LENGTH}
          accessibilityLabel="Message"
          className="max-h-32 min-h-10 flex-1 rounded-2xl bg-card px-4 py-2.5 text-[15px] text-white web:outline-none"
          textAlignVertical="center"
        />
        <Pressable
          disabled={!canSend}
          onPress={send}
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={cn(
            'h-10 w-10 items-center justify-center rounded-full',
            canSend ? 'bg-brand active:opacity-80 web:hover:bg-brand-hover' : 'bg-white/10',
          )}
        >
          <ArrowUp size={20} color={canSend ? '#196B07' : '#6B6B6B'} />
        </Pressable>
      </View>
    </View>
  );
};

export default memo(Composer);
