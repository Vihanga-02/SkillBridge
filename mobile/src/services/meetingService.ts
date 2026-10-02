import { httpsCallable } from 'firebase/functions';

import { functions } from '@/firebase/config';

export type MeetingCredentials = {
  serverUrl: string;
  participantToken: string;
  roomName: string;
};

type MeetingTokenRequest = {
  sessionId: string;
};

const createLiveKitToken = httpsCallable<MeetingTokenRequest, MeetingCredentials>(
  functions,
  'createLiveKitToken'
);

export async function getMeetingCredentials(sessionId: string): Promise<MeetingCredentials> {
  const result = await createLiveKitToken({ sessionId });
  return result.data;
}
