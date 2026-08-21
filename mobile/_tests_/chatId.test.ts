import { createChatId } from '../src/utils/chat';

describe('createChatId', () => {
  it('returns the same ID regardless of which participant starts the chat', () => {
    expect(createChatId('userA', 'userB')).toBe('userA_userB');
    expect(createChatId('userB', 'userA')).toBe('userA_userB');
  });

  it('sorts arbitrary UIDs into one stable document ID', () => {
    expect(createChatId('zoe-uid', 'amy-uid')).toBe('amy-uid_zoe-uid');
  });
});
