import { Platform, Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { SaveStatementFile } from '@/lib/statementFile.types';

// This file is only loaded on iOS and Android via Metro platform resolution (.native.ts).

/**
 * Hands a statement CSV to the user as a file, not as text.
 *
 * iOS writes it to the cache and opens the share sheet on the file's URL, which
 * offers Save to Files, Mail and AirDrop. Android's share sheet in React Native
 * carries text only, so the user picks a folder with the system picker and the
 * file is written there.
 *
 * Both use `expo-file-system`, which ships inside `expo` itself. A dedicated
 * sharing module would be a new native dependency, and an over-the-air update
 * reaching a build without it would crash on this screen.
 */
export const saveStatementFile: SaveStatementFile = async ({ filename, content }) => {
  if (Platform.OS === 'android') {
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch {
      // Closing the picker rejects; that is the user saying no, not a failure.
      return 'cancelled';
    }
    const file = directory.createFile(filename, 'text/csv');
    file.write(content);
    return 'saved';
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  const result = await Share.share({ url: file.uri, title: filename });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
};
