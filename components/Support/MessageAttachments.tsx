import { memo, useCallback, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText, ImageOff } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { attachmentUrl, isLinkFresh, refreshMessage } from '@/lib/support/sync';

import type { SupportAttachment, SupportMessage } from '@/lib/types/support';

const MAX_IMAGE_WIDTH = 240;
const MAX_IMAGE_HEIGHT = 320;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const imageSize = (file: SupportAttachment) => {
  if (!file.width || !file.height) return { width: MAX_IMAGE_WIDTH, height: 180 };
  const scale = Math.min(MAX_IMAGE_WIDTH / file.width, MAX_IMAGE_HEIGHT / file.height, 1);
  return { width: Math.round(file.width * scale), height: Math.round(file.height * scale) };
};

/** Opens a file in the browser or the system viewer, with a fresh link when the held one is about to expire. */
const openFile = async (message: SupportMessage, file: SupportAttachment) => {
  // The web opens the tab within the tap, or the browser blocks it as a popup.
  if (Platform.OS === 'web' && isLinkFresh(file.url) && file.url) {
    window.open(file.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const url = await attachmentUrl(message, file.key);
  if (url) await Linking.openURL(url);
};

const Unavailable = ({ label }: { label: string }) => (
  <View className="flex-row items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
    <ImageOff size={16} color="#A1A1A1" />
    <Text className="text-sm text-white/60">{label}</Text>
  </View>
);

const ImageAttachment = memo(function ImageAttachment({
  message,
  file,
}: {
  message: SupportMessage;
  file: SupportAttachment;
}) {
  const [retried, setRetried] = useState(false);
  const size = imageSize(file);

  // A link that expired before this image was first drawn: ask once for a fresh one.
  const handleError = useCallback(() => {
    if (retried) return;
    setRetried(true);
    void refreshMessage(message).catch(() => undefined);
  }, [message, retried]);

  if (!file.url)
    return (
      <Unavailable label={file.status === 'pending' ? 'Checking image…' : 'Image unavailable'} />
    );

  return (
    <Pressable
      onPress={() => void openFile(message, file)}
      accessibilityRole="imagebutton"
      accessibilityLabel={file.fileName ? `Open ${file.fileName}` : 'Open image'}
      className="overflow-hidden rounded-xl"
    >
      <Image
        // The key, not the link: links change every few minutes, the file never does.
        source={{ uri: file.url, cacheKey: file.key }}
        placeholder={file.blurhash ? { blurhash: file.blurhash } : undefined}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        style={size}
        onError={handleError}
      />
    </Pressable>
  );
});

const FileAttachment = memo(function FileAttachment({
  message,
  file,
}: {
  message: SupportMessage;
  file: SupportAttachment;
}) {
  if (!file.url)
    return (
      <Unavailable label={file.status === 'pending' ? 'Checking file…' : 'File unavailable'} />
    );
  return (
    <Pressable
      onPress={() => void openFile(message, file)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.fileName ?? 'file'}`}
      className="flex-row items-center gap-3 rounded-xl bg-black/20 px-3 py-2 active:opacity-70 web:hover:opacity-80"
    >
      <FileText size={20} color="#FFFFFF" />
      <View className="shrink">
        <Text numberOfLines={1} className="text-sm font-medium text-white">
          {file.fileName ?? 'Document'}
        </Text>
        <Text className="text-xs text-white/60">PDF · {formatSize(file.size)}</Text>
      </View>
    </Pressable>
  );
});

/** The files on one message: images inline, PDFs as a row that opens them. */
const MessageAttachments = ({ message }: { message: SupportMessage }) => {
  if (!message.attachments.length) return null;
  return (
    <View className="gap-2">
      {message.attachments.map(file =>
        file.mime.startsWith('image/') ? (
          <ImageAttachment key={file.key} message={message} file={file} />
        ) : (
          <FileAttachment key={file.key} message={message} file={file} />
        ),
      )}
    </View>
  );
};

export default memo(MessageAttachments);
