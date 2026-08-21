import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/firebase/config';
import { formatFileSize } from '@/utils/format';

export type UploadResult = { url: string; path: string; sizeBytes: number };

export function sanitizeStorageName(value: string, fallback = 'file'): string {
  const normalized = value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const extensionIndex = normalized.lastIndexOf('.');
  const hasExtension = extensionIndex > 0 && extensionIndex < normalized.length - 1;
  const baseName = hasExtension ? normalized.slice(0, extensionIndex) : normalized;
  const extension = hasExtension ? normalized.slice(extensionIndex + 1) : '';
  const sanitizePart = (part: string) =>
    part
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const sanitizedBaseName = sanitizePart(baseName) || fallback;
  const sanitizedExtension = sanitizePart(extension);

  return sanitizedExtension ? `${sanitizedBaseName}.${sanitizedExtension}` : sanitizedBaseName;
}

/**
 * The one upload helper every component reuses.
 *
 * The size check happens before `uploadBytes`, because Storage rules only reject
 * an oversized file after the bytes have already been sent — which on a phone
 * data plan is the user's money.
 *
 * `contentType` is passed explicitly: a `file://` blob often has an empty type,
 * and the Storage rules match on `contentType`, so relying on inference is how
 * you get a permission-denied on a file that should have been allowed.
 */
export async function uploadFile(
  path: string,
  localUri: string,
  maxBytes: number,
  contentType?: string,
  customMetadata?: Record<string, string>
): Promise<UploadResult> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > maxBytes) {
    throw new Error(
      `That file is ${formatFileSize(blob.size)}. The limit is ${formatFileSize(maxBytes)}.`
    );
  }

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    ...(contentType ? { contentType } : {}),
    ...(customMetadata ? { customMetadata } : {}),
  });

  return { url: await getDownloadURL(storageRef), path, sizeBytes: blob.size };
}

/** Missing files are not an error — a repeated delete should still succeed. */
export async function deleteFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'storage/object-not-found') throw error;
  }
}
