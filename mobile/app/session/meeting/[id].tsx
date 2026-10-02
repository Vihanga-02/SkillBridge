import { Ionicons } from '@expo/vector-icons';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ConnectionState, Track } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import {
  getMeetingCredentials,
  type MeetingCredentials,
} from '@/services/meetingService';
import { errorMessage } from '@/utils/authErrors';

export default function MeetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [credentials, setCredentials] = useState<MeetingCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    if (!id) {
      setError('Missing session.');
      return;
    }
    setError(null);
    setCredentials(null);
    try {
      setCredentials(await getMeetingCredentials(id));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [id]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!credentials) return;
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [credentials]);

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error} onRetry={() => void loadCredentials()} />
      </SafeAreaView>
    );
  }

  if (!credentials) {
    return <LoadingState fullScreen label="Preparing secure meeting…" />;
  }

  return (
    <LiveKitRoom
      serverUrl={credentials.serverUrl}
      token={credentials.participantToken}
      connect
      audio
      video
      onError={(meetingError) => setError(errorMessage(meetingError))}>
      <MeetingRoom />
    </LiveKitRoom>
  );
}

function MeetingRoom() {
  const connectionState = useConnectionState();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const speakingParticipants = useSpeakingParticipants();
  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
  } = useLocalParticipant();
  const [changingMedia, setChangingMedia] = useState(false);

  const localIdentity = localParticipant.identity;
  const localTrack = tracks.find((track) => track.participant.identity === localIdentity);
  const remoteTracks = tracks.filter((track) => track.participant.identity !== localIdentity);
  const remoteTeacherTrack = remoteTracks.find(
    (track) => participantRole(track.participant.metadata) === 'teacher'
  );
  const localRole = participantRole(localParticipant.metadata);
  const isLearnerView = localRole === 'learner' || !!remoteTeacherTrack;
  const activeRemoteSpeaker = speakingParticipants.find(
    (participant) => participant.identity !== localIdentity
  );
  const activeRemoteTrack = activeRemoteSpeaker
    ? remoteTracks.find(
        (track) => track.participant.identity === activeRemoteSpeaker.identity
      )
    : undefined;
  const mainTrack =
    (isLearnerView ? remoteTeacherTrack : activeRemoteTrack) ??
    remoteTracks[0] ??
    localTrack;
  const smallTracks = mainTrack
    ? tracks.filter((track) => track.participant.identity !== mainTrack.participant.identity)
    : [];

  async function toggleCamera() {
    setChangingMedia(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } finally {
      setChangingMedia(false);
    }
  }

  async function toggleMicrophone() {
    setChangingMedia(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } finally {
      setChangingMedia(false);
    }
  }

  const status =
    connectionState === ConnectionState.Connected
      ? `${tracks.length} participant${tracks.length === 1 ? '' : 's'}`
      : connectionState === ConnectionState.Reconnecting ||
          connectionState === ConnectionState.SignalReconnecting
        ? 'Reconnecting…'
        : 'Connecting…';

  return (
    <SafeAreaView style={styles.meetingSafe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.meetingTitle}>SkillBridge Session</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave meeting"
          onPress={() => router.back()}
          style={styles.headerLeave}>
          <Ionicons name="close" size={sizes.iconLg} color={colors.inkInverse} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {mainTrack ? (
          <ParticipantTile
            trackRef={mainTrack}
            local={mainTrack.participant.identity === localIdentity}
          />
        ) : (
          <View style={styles.waiting}>
            <Ionicons name="people" size={sizes.avatarLg} color={colors.inkInverseMuted} />
            <Text style={styles.waitingText}>Waiting for participants…</Text>
          </View>
        )}
      </View>

      {smallTracks.length > 0 ? (
        <FlatList
          horizontal
          data={smallTracks}
          style={styles.smallVideoRail}
          keyExtractor={(track) => `${track.participant.identity}-${track.source}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.smallVideoList}
          renderItem={({ item }) => (
            <View style={styles.smallVideoFrame}>
              <ParticipantTile
                trackRef={item}
                local={item.participant.identity === localIdentity}
              />
            </View>
          )}
        />
      ) : null}

      <View style={styles.controls}>
        <MeetingControl
          label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
          disabled={changingMedia}
          active={isMicrophoneEnabled}
          onPress={() => void toggleMicrophone()}
        />
        <MeetingControl
          label={isCameraEnabled ? 'Camera off' : 'Camera on'}
          icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
          disabled={changingMedia}
          active={isCameraEnabled}
          onPress={() => void toggleCamera()}
        />
        <MeetingControl
          label="Leave"
          icon="call"
          danger
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

function participantRole(metadata?: string): 'teacher' | 'learner' | null {
  if (!metadata) return null;
  try {
    const role = (JSON.parse(metadata) as { role?: unknown }).role;
    return role === 'teacher' || role === 'learner' ? role : null;
  } catch {
    return null;
  }
}

function ParticipantTile({
  trackRef,
  local = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  local?: boolean;
}) {
  const name = trackRef.participant.name || 'SkillBridge member';
  const role = participantRole(trackRef.participant.metadata);
  const content = (
    <>
      {isTrackReference(trackRef) ? (
        <VideoTrack
          trackRef={trackRef}
          style={styles.video}
          objectFit="cover"
          mirror={local}
        />
      ) : (
        <View style={styles.cameraOff}>
          <Ionicons name="person" size={sizes.avatarMd} color={colors.inkInverseMuted} />
        </View>
      )}
      <View style={styles.nameBadge}>
        <Text style={styles.participantName} numberOfLines={1}>
          {local ? 'You' : name}{role === 'teacher' ? ' · Teacher' : ''}
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.tile}>
      {content}
    </View>
  );
}

function MeetingControl({
  label,
  icon,
  active = false,
  danger = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        active && styles.controlActive,
        danger && styles.controlDanger,
        (pressed || disabled) && styles.controlPressed,
      ]}>
      <Ionicons name={icon} size={sizes.iconLg} color={colors.inkInverse} />
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  meetingSafe: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  meetingTitle: { ...type.h2, color: colors.inkInverse },
  status: { ...type.caption, color: colors.inkInverseMuted },
  headerLeave: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  stage: { flex: 1, paddingHorizontal: spacing.sm },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  waitingText: { ...type.body, color: colors.inkInverseMuted },
  smallVideoRail: {
    flexGrow: 0,
    flexShrink: 0,
    height: sizes.avatarLg + spacing.xxl + spacing.sm,
  },
  smallVideoList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  smallVideoFrame: {
    width: sizes.preview / 2,
    height: sizes.avatarLg + spacing.xxl,
  },
  tile: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.ink,
  },
  video: { flex: 1 },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nameBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '80%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
  },
  participantName: { ...type.caption, color: colors.inkInverse },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  control: { alignItems: 'center', gap: spacing.xs, minWidth: sizes.avatarLg },
  controlActive: {},
  controlDanger: {},
  controlPressed: { opacity: 0.6 },
  controlLabel: { ...type.caption, color: colors.inkInverse },
});
