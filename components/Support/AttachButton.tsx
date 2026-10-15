import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Image as ImageIcon, Paperclip } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { pickedMime, pickedName } from '@/lib/support/pickedFile';
import { MAX_ATTACHMENTS } from '@/lib/support/sync';

import type { SupportFile } from '@/lib/types/support';

export interface AttachButtonProps {
  disabled?: boolean;
  onPick: (files: SupportFile[]) => void;
}

/** Whether this platform shows the button (the composer pads around it). */
export const attachAvailable = true;

export type AttachSource = 'library' | 'camera' | 'files';

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.8,
  // HEIC photos arrive as JPEG, which every agent can open.
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

const fromImage = (asset: ImagePicker.ImagePickerAsset): SupportFile => {
  const mime = pickedMime(asset.fileName ?? asset.uri, asset.mimeType ?? '');
  return {
    uri: asset.uri,
    name: pickedName(asset.fileName ?? '', mime),
    mime,
    ...(asset.fileSize !== undefined && { size: asset.fileSize }),
  };
};

const fromDocument = (asset: DocumentPicker.DocumentPickerAsset): SupportFile => {
  const mime = pickedMime(asset.name, asset.mimeType ?? '');
  return {
    uri: asset.uri,
    name: pickedName(asset.name, mime),
    mime,
    ...(asset.size !== undefined && { size: asset.size }),
  };
};

/** Opens the chosen picker; nothing when the person cancels. */
export async function pickFrom(source: AttachSource): Promise<SupportFile[]> {
  if (source === 'files') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    return result.canceled ? [] : result.assets.map(fromDocument);
  }
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: 'error',
        text1: 'Camera access is off',
        text2: 'Turn it on for Solid in Settings to take a photo.',
      });
      return [];
    }
    const result = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);
    return result.canceled ? [] : result.assets.map(fromImage);
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...IMAGE_OPTIONS,
    allowsMultipleSelection: true,
    selectionLimit: MAX_ATTACHMENTS,
  });
  return result.canceled ? [] : result.assets.map(fromImage);
}

const CHOICES: { source: AttachSource; label: string; Icon: typeof Camera }[] = [
  { source: 'library', label: 'Photo library', Icon: ImageIcon },
  { source: 'camera', label: 'Take a photo', Icon: Camera },
  { source: 'files', label: 'Choose a file', Icon: FileText },
];

/**
 * The app's attach button (iOS and Android): a paperclip that offers the photo
 * library, the camera or a file (PDF or image). The web uses AttachButton.web.tsx.
 */
export default function AttachButton({ disabled, onPick }: AttachButtonProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // iOS cannot show a picker while the menu is still closing: it opens once the menu is gone.
  const chosen = useRef<AttachSource | null>(null);

  const launch = useCallback(async () => {
    const source = chosen.current;
    chosen.current = null;
    if (!source) return;
    try {
      const files = await pickFrom(source);
      if (files.length) onPick(files);
    } catch {
      Toast.show({
        type: 'error',
        text1: "Couldn't open that",
        text2: 'Try again, or pick the file another way.',
      });
    }
  }, [onPick]);

  const choose = (source: AttachSource) => {
    chosen.current = source;
    setOpen(false);
    if (Platform.OS !== 'ios') void launch();
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Attach a photo or PDF"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-white/10 disabled:opacity-40"
      >
        <Paperclip size={18} color="#A1A1A1" />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        onDismiss={() => void launch()}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
        >
          <View
            className="mx-3 overflow-hidden rounded-2xl bg-card"
            style={{ marginBottom: Math.max(insets.bottom, 12) }}
          >
            {CHOICES.map(({ source, label, Icon }) => (
              <Pressable
                key={source}
                testID={`support-attach-${source}`}
                onPress={() => choose(source)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 border-b border-white/5 px-5 py-4 active:bg-white/5"
              >
                <Icon size={20} color="#FFFFFF" />
                <Text className="text-base text-white">{label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              className="items-center px-5 py-4 active:bg-white/5"
            >
              <Text className="text-base font-semibold text-muted-foreground">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
