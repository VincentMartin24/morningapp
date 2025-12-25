import {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  copyAsync,
  downloadAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const NOTIFICATION_SOUND_FILENAME = 'morning-alarm-notification.wav';

function getLibrarySoundsPath(): string {
  if (Platform.OS === 'ios') {
    const libraryPath = documentDirectory?.replace('/Documents/', '/Library/Sounds/') || '';
    return libraryPath;
  }
  return `${documentDirectory}sounds/`;
}

function getNotificationSoundPath(): string {
  return `${getLibrarySoundsPath()}${NOTIFICATION_SOUND_FILENAME}`;
}

async function ensureSoundsDirectoryExists(): Promise<void> {
  if (Platform.OS === 'web') return;

  const soundsPath = getLibrarySoundsPath();
  const dirInfo = await getInfoAsync(soundsPath);

  if (!dirInfo.exists) {
    await makeDirectoryAsync(soundsPath, { intermediates: true });
  }
}

function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

function extractBase64FromDataUri(dataUri: string): string | null {
  try {
    const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function saveNotificationSound(audioUrl: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    await ensureSoundsDirectoryExists();

    const soundPath = getNotificationSoundPath();

    const existingFile = await getInfoAsync(soundPath);
    if (existingFile.exists) {
      await deleteAsync(soundPath, { idempotent: true });
    }

    if (isDataUri(audioUrl)) {
      const base64Data = extractBase64FromDataUri(audioUrl);
      if (!base64Data) {
        throw new Error('Invalid data URI format');
      }

      await writeAsStringAsync(soundPath, base64Data, {
        encoding: EncodingType.Base64,
      });
    } else {
      const downloadResult = await downloadAsync(audioUrl, soundPath);

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download audio');
      }
    }

    const savedFile = await getInfoAsync(soundPath);
    if (!savedFile.exists) {
      throw new Error('Sound file was not saved');
    }

    return NOTIFICATION_SOUND_FILENAME;
  } catch (error) {
    console.error('Error saving notification sound:', error);
    return null;
  }
}

export async function deleteNotificationSound(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const soundPath = getNotificationSoundPath();
    const fileInfo = await getInfoAsync(soundPath);

    if (fileInfo.exists) {
      await deleteAsync(soundPath, { idempotent: true });
    }
  } catch (error) {
    console.error('Error deleting notification sound:', error);
  }
}

export function getNotificationSoundName(): string {
  return NOTIFICATION_SOUND_FILENAME;
}
