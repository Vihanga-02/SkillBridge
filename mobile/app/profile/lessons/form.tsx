import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CAREER_GOALS, type CareerGoalTag } from '@/constants/careerGoals';
import { FILE_LIMITS } from '@/constants/config';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMediaPicker, type PickedFile } from '@/hooks/useMediaPicker';
import {
  createLesson,
  extractYouTubeVideoId,
  getLesson,
  updateLesson,
  type LessonContentInput,
} from '@/services/lessonService';
import type { Lesson, LessonContent } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatFileSize } from '@/utils/format';

type DraftContent =
  | {
      id: string;
      type: 'youtube';
      title: string;
      url: string;
      videoId?: string;
    }
  | {
      id: string;
      type: 'pdf';
      title: string;
      fileName: string;
      fileUrl?: string;
      filePath?: string;
      fileSizeBytes?: number;
      replacement?: PickedFile;
    };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function lessonToDrafts(lesson: Lesson): DraftContent[] {
  return lesson.contents.map((item: LessonContent) =>
    item.type === 'youtube'
      ? { id: item.id, type: 'youtube', title: item.title, url: item.url, videoId: item.videoId }
      : {
          id: item.id,
          type: 'pdf',
          title: item.title,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          filePath: item.filePath,
          fileSizeBytes: item.fileSizeBytes,
        }
  );
}

export default function LessonFormScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId?: string }>();
  const { profile } = useAuth();
  const { pickPdf, error: pickerError, clearError } = useMediaPicker();

  const isEditing = !!lessonId;
  const goalOptions = useMemo(
    () => CAREER_GOALS.map((goal) => ({ value: goal.tag, label: goal.label })),
    []
  );

  const [lessonName, setLessonName] = useState('');
  const [careerGoalId, setCareerGoalId] = useState<CareerGoalTag | null>(null);
  const [contents, setContents] = useState<DraftContent[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId || !profile) return;

    let active = true;
    (async () => {
      try {
        const lesson = await getLesson(lessonId);
        if (!active) return;
        if (!lesson) {
          setError('That lesson no longer exists.');
        } else if (lesson.teacherId !== profile.uid) {
          setError('Only the teacher who created this lesson can edit it.');
        } else {
          setLessonName(lesson.lessonName);
          setCareerGoalId(lesson.careerGoalId);
          setContents(lessonToDrafts(lesson));
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
  }, [lessonId, profile]);

  if (!profile) return <LoadingState fullScreen label="Loading..." />;

  if (profile.role === 'learner') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Create lesson" showBack />
        <View style={styles.padded}>
          <Notice tone="info" message="Switch your role to Teach or Teach & learn before creating lessons." />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Edit lesson" showBack />
        <LoadingState label="Loading lesson..." />
      </SafeAreaView>
    );
  }

  const updateContent = (id: string, patch: Partial<DraftContent>) => {
    setContents((current) =>
      current.map((item) => (item.id === id ? ({ ...item, ...patch } as DraftContent) : item))
    );
  };

  const removeContent = (item: DraftContent) => {
    Alert.alert('Remove content?', 'This content item will be removed from the lesson.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setContents((current) => current.filter((entry) => entry.id !== item.id)),
      },
    ]);
  };

  const addYoutube = () => {
    setContents((current) => [
      ...current,
      { id: newId(), type: 'youtube', title: '', url: '' },
    ]);
  };

  const addPdf = async () => {
    clearError();
    const file = await pickPdf(FILE_LIMITS.lessonPdf);
    if (!file) return;

    setContents((current) => [
      ...current,
      {
        id: newId(),
        type: 'pdf',
        title: file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        replacement: file,
      },
    ]);
  };

  const replacePdf = async (id: string) => {
    clearError();
    const file = await pickPdf(FILE_LIMITS.lessonPdf);
    if (!file) return;
    updateContent(id, {
      title: file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      replacement: file,
    } as Partial<DraftContent>);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const inputContents: LessonContentInput[] = contents.map((item) =>
        item.type === 'youtube'
          ? {
              id: item.id,
              type: 'youtube',
              title: item.title,
              url: item.url,
              videoId: extractYouTubeVideoId(item.url) ?? undefined,
            }
          : {
              id: item.id,
              type: 'pdf',
              title: item.title,
              fileName: item.fileName,
              fileUrl: item.fileUrl,
              filePath: item.filePath,
              fileSizeBytes: item.fileSizeBytes,
              replacement: item.replacement
                ? {
                    uri: item.replacement.uri,
                    name: item.replacement.name,
                    contentType: item.replacement.contentType,
                  }
                : undefined,
            }
      );

      if (isEditing && lessonId) {
        await updateLesson(profile, lessonId, { lessonName, careerGoalId, contents: inputContents });
      } else {
        await createLesson(profile, { lessonName, careerGoalId, contents: inputContents });
      }

      router.replace('/profile/lessons' as Href);
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEditing ? 'Edit lesson' : 'Create lesson'}
        subtitle="Build the content learners will see."
        showBack
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {error ? <Notice tone="error" message={error} /> : null}
          {pickerError ? <Notice tone="error" message={pickerError} /> : null}

          <Input
            label="Lesson name"
            value={lessonName}
            onChangeText={setLessonName}
            placeholder="Introduction to Git"
            autoCapitalize="sentences"
            maxLength={120}
          />

          <ChipSelect
            label="Career Goal"
            options={goalOptions}
            value={careerGoalId}
            onChange={setCareerGoalId}
            helper="Career goals are loaded from the shared SkillBridge taxonomy."
          />

          <View style={styles.contentHeader}>
            <View style={styles.contentHeaderText}>
              <Text style={styles.sectionTitle}>Learning Content</Text>
              <Text style={styles.helper}>Add multiple videos and PDFs to one lesson.</Text>
            </View>
          </View>

          <View style={styles.addRow}>
            <Button
              label="Add YouTube Video"
              variant="secondary"
              icon="logo-youtube"
              onPress={addYoutube}
              style={styles.addButton}
            />
            <Button
              label="Add PDF"
              variant="secondary"
              icon="document-attach-outline"
              onPress={() => void addPdf()}
              style={styles.addButton}
            />
          </View>

          {contents.map((item, index) => (
            <Card key={item.id}>
              <View style={styles.item}>
                <View style={styles.itemHeading}>
                  <Ionicons
                    name={item.type === 'youtube' ? 'logo-youtube' : 'document-text-outline'}
                    size={sizes.iconMd}
                    color={colors.accent}
                  />
                  <Text style={styles.itemTitle}>
                    {index + 1}. {item.type === 'youtube' ? 'YouTube Video' : 'PDF'}
                  </Text>
                  <Pressable
                    onPress={() => removeContent(item)}
                    hitSlop={spacing.md}
                    accessibilityRole="button"
                    accessibilityLabel="Remove content">
                    <Ionicons name="trash-outline" size={sizes.iconMd} color={colors.danger} />
                  </Pressable>
                </View>

                <Input
                  label="Title"
                  value={item.title}
                  onChangeText={(value) => updateContent(item.id, { title: value } as Partial<DraftContent>)}
                  placeholder={item.type === 'youtube' ? 'Git & GitHub for Beginners' : 'Git Cheat Sheet'}
                  autoCapitalize="sentences"
                  maxLength={120}
                />

                {item.type === 'youtube' ? (
                  <Input
                    label="YouTube Video URL"
                    value={item.url}
                    onChangeText={(value) => updateContent(item.id, { url: value } as Partial<DraftContent>)}
                    placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
                    helper={
                      extractYouTubeVideoId(item.url)
                        ? `Video ID: ${extractYouTubeVideoId(item.url)}`
                        : 'Paste a youtube.com or youtu.be link.'
                    }
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                ) : (
                  <View style={styles.pdfBlock}>
                    <Text style={styles.label}>Selected PDF</Text>
                    <View style={styles.filePill}>
                      <Ionicons name="document-outline" size={sizes.iconMd} color={colors.accent} />
                      <Text style={styles.fileName} numberOfLines={1}>
                        {item.replacement
                          ? `${item.replacement.name} (${formatFileSize(item.replacement.sizeBytes)})`
                          : item.fileName}
                      </Text>
                    </View>
                    <Button
                      label="Replace PDF"
                      variant="secondary"
                      icon="swap-horizontal-outline"
                      onPress={() => void replacePdf(item.id)}
                    />
                  </View>
                )}
              </View>
            </Card>
          ))}

          <Button
            label={isEditing ? 'Save changes' : 'Create lesson'}
            onPress={() => void save()}
            loading={saving}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  padded: {
    padding: spacing.lg,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contentHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.ink,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addButton: {
    flex: 1,
  },
  item: {
    gap: spacing.md,
  },
  itemHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  pdfBlock: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
  },
  fileName: {
    ...type.body,
    color: colors.ink,
    flex: 1,
  },
  save: {
    marginTop: spacing.md,
  },
});
