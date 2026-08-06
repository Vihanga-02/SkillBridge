import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { formatFileSize } from '@/utils/format';

export type PickedFile = {
  uri: string;
  /** `-1` when the platform did not report a size; the upload helper re-checks. */
  sizeBytes: number;
  contentType: string;
  kind: 'image' | 'pdf';
  name: string;
};

type PickImageOptions = {
  maxBytes: number;
  /** Square crop for avatars. */
  square?: boolean;
  quality?: number;
};

/**
 * Image and document picking with the size check applied at pick time, so the
 * user is told a file is too big before an upload starts rather than after.
 */
export function useMediaPicker() {
  const [error, setError] = useState<string | null>(null);

  const check = useCallback((sizeBytes: number, maxBytes: number): boolean => {
    if (sizeBytes > 0 && sizeBytes > maxBytes) {
      setError(
        `That file is ${formatFileSize(sizeBytes)}. Please choose one under ${formatFileSize(maxBytes)}.`
      );
      return false;
    }
    return true;
  }, []);

  const pickImage = useCallback(
    async ({ maxBytes, square = false, quality = 0.6 }: PickImageOptions): Promise<PickedFile | null> => {
      setError(null);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('SkillBridge needs permission to open your photos. Enable it in Settings.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: square,
        aspect: square ? [1, 1] : undefined,
        quality,
      });

      if (result.canceled) return null;

      const asset = result.assets[0];
      const sizeBytes = asset.fileSize ?? -1;
      if (!check(sizeBytes, maxBytes)) return null;

      return {
        uri: asset.uri,
        sizeBytes,
        contentType: asset.mimeType ?? 'image/jpeg',
        kind: 'image',
        name: asset.fileName ?? 'image.jpg',
      };
    },
    [check]
  );

  const pickPdf = useCallback(
    async (maxBytes: number): Promise<PickedFile | null> => {
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return null;

      const asset = result.assets[0];
      const sizeBytes = asset.size ?? -1;
      if (!check(sizeBytes, maxBytes)) return null;

      return {
        uri: asset.uri,
        sizeBytes,
        contentType: 'application/pdf',
        kind: 'pdf',
        name: asset.name,
      };
    },
    [check]
  );

  return { pickImage, pickPdf, error, clearError: () => setError(null) };
}
