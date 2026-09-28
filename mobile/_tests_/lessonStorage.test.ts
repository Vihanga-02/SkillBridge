jest.mock('@/firebase/config', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ deleteObject: jest.fn(), ref: jest.fn((_storage, path) => path) }));
import { deleteObject } from 'firebase/storage';
import { deleteFile } from '@/utils/storage';

it('treats an already-deleted PDF as successful cleanup', async () => {
  (deleteObject as jest.Mock).mockRejectedValueOnce({ code: 'storage/object-not-found' });
  await expect(deleteFile('lessons/lesson/file.pdf')).resolves.toBeUndefined();
});
it('keeps real Storage failures visible so lesson cleanup can resume', async () => {
  (deleteObject as jest.Mock).mockRejectedValueOnce({ code: 'storage/unauthorized' });
  await expect(deleteFile('lessons/lesson/file.pdf')).rejects.toEqual({ code: 'storage/unauthorized' });
});
