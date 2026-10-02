/** The image contract shared by the chat and community-post upload flows. */
export type CommunityImageUpload = {
  uri: string;
  contentType: string;
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
};

/**
 * Reject unexpected media before any bytes are uploaded. Storage Rules repeat
 * this check, because client validation alone is never an access-control layer.
 */
export function validateCommunityImageUpload(image: CommunityImageUpload): CommunityImageUpload {
  const uri = image.uri.trim();
  const contentType = image.contentType.trim().toLowerCase().split(';')[0];

  if (!uri) throw new Error('Choose an image before uploading.');
  if (!EXTENSIONS[contentType]) {
    throw new Error('Choose a JPG, PNG, WebP, GIF, HEIC or AVIF image.');
  }

  return { uri, contentType };
}

/** Each upload gets its own immutable path, so replacing/deleting never overwrites another item. */
export function communityImagePath(
  kind: 'chats' | 'posts',
  parentId: string,
  itemId: string,
  contentType: string
): string {
  const normalized = validateCommunityImageUpload({ uri: 'local', contentType });
  if (!parentId || !itemId) throw new Error('Unable to prepare the image upload.');

  return `${kind}/${parentId}/${itemId}.${EXTENSIONS[normalized.contentType]}`;
}
