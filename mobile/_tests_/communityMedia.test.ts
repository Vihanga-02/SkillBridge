import { communityImagePath, validateCommunityImageUpload } from '@/services/communityMedia';

describe('community image uploads', () => {
  it('accepts a supported image and normalizes its URI and MIME type', () => {
    expect(
      validateCommunityImageUpload({
        uri: '  file:///photo.png  ',
        contentType: 'IMAGE/PNG; charset=utf-8',
      })
    ).toEqual({ uri: 'file:///photo.png', contentType: 'image/png' });
  });

  it('rejects an upload with no selected image or an unsupported file type', () => {
    expect(() => validateCommunityImageUpload({ uri: '   ', contentType: 'image/jpeg' })).toThrow(
      'Choose an image before uploading.'
    );
    expect(() => validateCommunityImageUpload({ uri: 'file:///notes.pdf', contentType: 'application/pdf' })).toThrow(
      'Choose a JPG, PNG, WebP, GIF, HEIC or AVIF image.'
    );
  });

  it('creates separate immutable paths for post and chat images', () => {
    expect(communityImagePath('posts', 'post-1', 'image-1', 'image/webp')).toBe(
      'posts/post-1/image-1.webp'
    );
    expect(communityImagePath('chats', 'chat-1', 'message-1', 'image/jpeg')).toBe(
      'chats/chat-1/message-1.jpg'
    );
  });

  it('does not create an image path without its parent or item ID', () => {
    expect(() => communityImagePath('posts', '', 'image-1', 'image/png')).toThrow(
      'Unable to prepare the image upload.'
    );
    expect(() => communityImagePath('chats', 'chat-1', '', 'image/png')).toThrow(
      'Unable to prepare the image upload.'
    );
  });
});
