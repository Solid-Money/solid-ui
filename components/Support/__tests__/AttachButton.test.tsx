import React from 'react';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import AttachButton, { attachAvailable, pickFrom } from '@/components/Support/AttachButton';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('@/lib/support/sync', () => ({ MAX_ATTACHMENTS: 5 }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => ({
  Camera: 'Camera',
  FileText: 'FileText',
  Image: 'ImageIcon',
  Paperclip: 'Paperclip',
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

const images = ImagePicker as jest.Mocked<typeof ImagePicker>;
const documents = DocumentPicker as jest.Mocked<typeof DocumentPicker>;

describe('AttachButton (iOS and Android)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is shown in the app', () => {
    expect(attachAvailable).toBe(true);
  });

  it('picks several photos, as JPEG, up to the per-message limit', async () => {
    images.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///a.jpg',
          fileName: 'IMG_1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 10,
          width: 1,
          height: 1,
        },
        { uri: 'file:///b.png', fileName: null, mimeType: undefined, width: 1, height: 1 },
      ],
    } as never);
    expect(await pickFrom('library')).toEqual([
      { uri: 'file:///a.jpg', name: 'IMG_1.jpg', mime: 'image/jpeg', size: 10 },
      { uri: 'file:///b.png', name: 'photo.jpg', mime: 'image/png' },
    ]);
    expect(images.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        preferredAssetRepresentationMode: 'compatible',
      }),
    );
  });

  it('picks PDFs and images from files', async () => {
    documents.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///s.pdf',
          name: 'Statement.pdf',
          mimeType: 'application/pdf',
          size: 99,
          lastModified: 0,
        },
      ],
    } as never);
    expect(await pickFrom('files')).toEqual([
      { uri: 'file:///s.pdf', name: 'Statement.pdf', mime: 'application/pdf', size: 99 },
    ]);
    expect(documents.getDocumentAsync).toHaveBeenCalledWith({
      type: ['image/*', 'application/pdf'],
      multiple: true,
      copyToCacheDirectory: true,
    });
  });

  it('asks for the camera, and says how to turn it on when refused', async () => {
    images.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    expect(await pickFrom('camera')).toEqual([]);
    expect(images.launchCameraAsync).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Camera access is off' }),
    );
  });

  it('hands nothing over when the person cancels', async () => {
    images.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickFrom('library')).toEqual([]);
  });

  it('opens the menu and hands the picked files to the composer', async () => {
    documents.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///s.pdf',
          name: 'S.pdf',
          mimeType: 'application/pdf',
          size: 9,
          lastModified: 0,
        },
      ],
    } as never);
    const onPick = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AttachButton onPick={onPick} />);
    });
    const root = renderer!.root;
    act(() => root.findByProps({ accessibilityLabel: 'Attach a photo or PDF' }).props.onPress());
    const modal = root.findByProps({ transparent: true });
    expect(modal.props.visible).toBe(true);
    const choose = root.findByProps({ testID: 'support-attach-files' });
    await act(async () => {
      choose.props.onPress();
    });
    // iOS opens the picker once the menu has closed.
    await act(async () => {
      modal.props.onDismiss();
    });
    expect(onPick).toHaveBeenCalledWith([
      { uri: 'file:///s.pdf', name: 'S.pdf', mime: 'application/pdf', size: 9 },
    ]);
    expect(documents.getDocumentAsync).toHaveBeenCalledTimes(1);
  });
});
