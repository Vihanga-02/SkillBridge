import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ProgressBar } from '@/components/lesson/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  extractYouTubeVideoId,
  getEnrollment,
  getLesson,
  toggleLessonContentDone,
  youtubeEmbedUrl,
} from '@/services/lessonService';
import type { Lesson, LessonContent, LessonEnrollment } from '@/types';
import { errorMessage } from '@/utils/authErrors';

const YOUTUBE_PLAYER_ORIGIN = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN}`
  : 'https://localhost';

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [enrollment, setEnrollment] = useState<LessonEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [savingContentId, setSavingContentId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!id || !profile) return;

    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      setAccessDenied(false);
      try {
        const row = await getLesson(id);
        if (!active) return;
        if (!row || row.published === false) setError('That lesson is not available.');
        else {
          const nextEnrollment = await getEnrollment(profile.uid, row.id);
          if (!active) return;
          if (row.teacherId !== profile.uid && !nextEnrollment) {
            setAccessDenied(true);
            setError('Enroll in this lesson to access the learning materials.');
          } else {
            setLesson(row);
            setEnrollment(nextEnrollment);
            setCompleted(nextEnrollment?.completed ?? false);
          }
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, profile]);

  async function toggleContentDone(contentId: string) {
    if (!profile || !lesson || !enrollment) return;
    setSavingContentId(contentId);
    setError(null);
    try {
      const nextEnrollment = await toggleLessonContentDone(profile, lesson, contentId);
      setEnrollment(nextEnrollment);
      setCompleted(nextEnrollment.completed);
    } catch (progressError) {
      setError(errorMessage(progressError));
    } finally {
      setSavingContentId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Lesson" showBack />
        <LoadingState label="Loading lesson..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={lesson?.lessonName ?? 'Lesson'} showBack />

        {error ? <Notice tone="error" message={error} /> : null}
        {accessDenied && id ? (
          <Button
            label="View Course Details"
            variant="secondary"
            icon="information-circle-outline"
            onPress={() => router.replace({ pathname: '/lesson/details/[id]', params: { id } })}
          />
        ) : null}

        {lesson ? (
          <>
            <Card>
              <View style={styles.summary}>
                <Text style={styles.goal}>Career Goal: {lesson.careerGoalName}</Text>
                <Text style={styles.teacher}>Created by {lesson.teacherName || 'SkillBridge teacher'}</Text>
                <Text style={styles.meta}>
                  {lesson.contents.length} content {lesson.contents.length === 1 ? 'item' : 'items'}
                </Text>
                          <EnrollmentCount lessonId={lesson.id} />
                {enrollment ? (
                  <ProgressBar progress={enrollment.progress} completed={enrollment.completed} />
                ) : null}
              </View>
            </Card>

            {lesson.contents.map((item, index) => (
              <ContentBlock
                key={item.id}
                item={item}
                index={index}
                done={!!enrollment?.completedContentIds.includes(item.id)}
                saving={savingContentId === item.id}
                onToggleDone={
                  enrollment ? () => void toggleContentDone(item.id) : undefined
                }
              />
            ))}

            {enrollment ? (
              completed ? (
                <Notice tone="success" message="✓ Lesson Completed" />
              ) : null
            ) : (
              <Notice tone="info" message="This is your lesson. Learner progress is tracked after enrollment." />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContentBlock({
  item,
  index,
  done,
  saving,
  onToggleDone,
}: {
  item: LessonContent;
  index: number;
  done: boolean;
  saving: boolean;
  onToggleDone?: () => void;
}) {
  const embedUrl =
    item.type === 'youtube'
      ? youtubeEmbedUrl(item.videoId) ?? youtubeEmbedUrl(item.url)
      : null;
  const videoId =
    item.type === 'youtube'
      ? extractYouTubeVideoId(item.videoId) ?? extractYouTubeVideoId(item.url)
      : null;

  if (__DEV__ && item.type === 'youtube') {
    console.log('YouTube lesson content', {
      title: item.title,
      storedVideoId: item.videoId,
      storedUrl: item.url,
      extractedVideoId: videoId,
      embedUrl,
    });
  }

  return (
    <Card>
      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Ionicons
            name={item.type === 'youtube' ? 'logo-youtube' : 'document-text-outline'}
            size={sizes.iconMd}
            color={colors.accent}
          />
          <View style={styles.blockTitleText}>
            <Text style={styles.blockTitle}>
              {index + 1}. {item.title}
            </Text>
            <Text style={styles.meta}>{item.type === 'youtube' ? 'YouTube Video' : item.fileName}</Text>
          </View>
        </View>

        {item.type === 'youtube' ? (
          <YouTubePlayer embedUrl={embedUrl} videoId={videoId} />
        ) : (
          <Button
            label="Open PDF"
            variant="secondary"
            icon="open-outline"
            onPress={() => void WebBrowser.openBrowserAsync(item.fileUrl)}
          />
        )}

        {onToggleDone ? (
          <Button
            label={done ? '✓ Done' : 'Mark as Done'}
            variant={done ? 'secondary' : 'primary'}
            icon={done ? 'checkmark-circle-outline' : 'checkmark-outline'}
            loading={saving}
            onPress={onToggleDone}
          />
        ) : null}
      </View>
    </Card>
  );
}

function YouTubePlayer({ embedUrl, videoId }: { embedUrl: string | null; videoId: string | null }) {
  const [playerError, setPlayerError] = useState<number | 'config' | 'external-navigation' | null>(null);

  if (!embedUrl || !videoId) {
    return <Notice tone="error" message="This YouTube link could not be loaded." />;
  }

  if (playerError === 101 || playerError === 150) {
    return (
      <Notice
        tone="error"
        message="This video does not allow embedded playback. Please ask the teacher to replace it."
      />
    );
  }

  if (playerError) {
    return <Notice tone="error" message="YouTube player could not be loaded." />;
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
      #player { position: fixed; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="player"></div>
    <script src="https://www.youtube.com/iframe_api"></script>
    <script>
      function send(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function onYouTubeIframeAPIReady() {
        new YT.Player('player', {
          width: '100%',
          height: '100%',
          videoId: '${videoId}',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: '${YOUTUBE_PLAYER_ORIGIN}'
          },
          events: {
            onReady: function() { send({ event: 'ready', videoId: '${videoId}' }); },
            onError: function(event) { send({ event: 'error', code: event.data, videoId: '${videoId}' }); }
          }
        });
      }

      window.onerror = function(message, source, lineno, colno) {
        send({ event: 'config-error', message: String(message), source: String(source), line: lineno, column: colno });
      };
    </script>
  </body>
</html>`;

  return (
    <View style={styles.player}>
      <WebView
        source={{ html, baseUrl: YOUTUBE_PLAYER_ORIGIN }}
        originWhitelist={['https://*', 'about:blank']}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as {
              event?: string;
              code?: number;
              message?: string;
            };

            if (payload.event === 'error') {
              console.warn('YouTube player error', { videoId, code: payload.code });
              setPlayerError(payload.code ?? 'config');
            } else if (payload.event === 'config-error') {
              console.warn('YouTube player configuration error', payload);
              setPlayerError('config');
            }
          } catch {
            console.warn('YouTube player sent an unreadable message', event.nativeEvent.data);
          }
        }}
        onError={(event) => {
          console.warn('YouTube WebView load error', {
            videoId,
            description: event.nativeEvent.description,
            code: event.nativeEvent.code,
          });
          setPlayerError('config');
        }}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url.toLowerCase();
          const isExternalYoutubePage =
            url.includes('youtube.com/watch') ||
            url.includes('m.youtube.com/watch') ||
            url.includes('youtu.be/');

          if (isExternalYoutubePage) {
            console.warn('Blocked external YouTube navigation', { videoId, url: request.url });
            setPlayerError('external-navigation');
            return false;
          }

          return true;
        }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summary: {
    gap: spacing.sm,
  },
  goal: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  teacher: {
    ...type.body,
    color: colors.inkMuted,
  },
  meta: {
    ...type.caption,
    color: colors.inkMuted,
  },
  block: {
    gap: spacing.md,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockTitleText: {
    flex: 1,
    gap: spacing.xs,
  },
  blockTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  player: {
    aspectRatio: 16 / 9,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.ink,
  },
});
