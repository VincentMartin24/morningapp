import {
  documentDirectory,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const AUDIO_DIRNAME = 'morning-audio';
const AUDIO_FILENAME = 'morning-alarm.mp3';

function getAudioDirectoryPath(): string {
  return `${documentDirectory}${AUDIO_DIRNAME}/`;
}

function getAudioFilePath(): string {
  return `${getAudioDirectoryPath()}${AUDIO_FILENAME}`;
}

export async function ensureDirectoryExists(): Promise<void> {
  if (Platform.OS === 'web') return;

  const dirPath = getAudioDirectoryPath();
  const dirInfo = await getInfoAsync(dirPath);

  if (!dirInfo.exists) {
    await makeDirectoryAsync(dirPath, { intermediates: true });
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

export async function saveAudioLocally(audioUrl: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return audioUrl;
  }

  try {
    await ensureDirectoryExists();

    const filePath = getAudioFilePath();

    const fileInfo = await getInfoAsync(filePath);
    if (fileInfo.exists) {
      await deleteAsync(filePath, { idempotent: true });
    }

    if (isDataUri(audioUrl)) {
      const base64Data = extractBase64FromDataUri(audioUrl);
      if (!base64Data) {
        throw new Error('Invalid data URI format');
      }

      await writeAsStringAsync(filePath, base64Data, {
        encoding: EncodingType.Base64,
      });

      return filePath;
    } else {
      const downloadResult = await downloadAsync(audioUrl, filePath);

      if (downloadResult.status === 200) {
        return downloadResult.uri;
      }

      return null;
    }
  } catch (error) {
    console.error('Error saving audio locally:', error);
    return null;
  }
}

export async function getLocalAudioPath(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const filePath = getAudioFilePath();
    const fileInfo = await getInfoAsync(filePath);

    if (fileInfo.exists) {
      return filePath;
    }

    return null;
  } catch (error) {
    console.error('Error getting local audio path:', error);
    return null;
  }
}

export async function deleteLocalAudio(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const filePath = getAudioFilePath();
    const fileInfo = await getInfoAsync(filePath);

    if (fileInfo.exists) {
      await deleteAsync(filePath, { idempotent: true });
    }
  } catch (error) {
    console.error('Error deleting local audio:', error);
  }
}
