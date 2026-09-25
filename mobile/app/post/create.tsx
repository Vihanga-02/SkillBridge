import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SKILLS, type SkillTag } from '@/constants/skills';
import { FILE_LIMITS, TEXT_LIMITS } from '@/constants/config';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMediaPicker, type PickedFile } from '@/hooks/useMediaPicker';
import { createPost } from '@/services/postService';
import type { PostType } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatFileSize } from '@/utils/format';

const POST_TYPES: { value: PostType; label: string; icon: 'trophy-outline' | 'bulb-outline' | 'help-circle-outline' }[] = [
  { value: 'achievement', label: 'Achievement', icon: 'trophy-outline' },
  { value: 'tip', label: 'Tip', icon: 'bulb-outline' },
  { value: 'question', label: 'Question', icon: 'help-circle-outline' },
];

/** Community post composer with an optional, size-limited image attachment. */
export default function CreatePostScreen() {
  const { profile } = useAuth();
  const [postType, setPostType] = useState<PostType>('tip');
  const [text, setText] = useState('');
  const [skillTag, setSkillTag] = useState<SkillTag | null>(null);
  const [image, setImage] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pickImage, error: mediaError, clearError: clearMediaError } = useMediaPicker();

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  async function handlePublish() {
    const author = profile;
    if (!author || saving) return;

    setSaving(true);
    setError(null);
    try {
      await createPost(author, {
        type: postType,
        text,
        skillTag,
        image: image ? { uri: image.uri, contentType: image.contentType } : undefined,
      });
      // Returning preserves Community's active Feed tab; its focus listener
      // refreshes the list and shows the new post immediately.
      router.back();
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setSaving(false);
    }
  }

  async function handlePickImage() {
    if (saving) return;

    const selected = await pickImage({ maxBytes: FILE_LIMITS.postImage, quality: 0.75 });
    if (selected) setImage(selected);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Create post" subtitle="Share a useful idea with the community." showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {error ? <Notice tone="error" message={error} /> : null}
          {mediaError ? <Notice tone="error" message={mediaError} /> : null}

          <View style={styles.section}>
            {POST_TYPES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={postType === option.value}
                onPress={() => setPostType(option.value)}
              />
            ))}
          </View>

          <Input
            label="Your post"
            value={text}
            onChangeText={setText}
            placeholder="Share an achievement, helpful tip or question…"
            autoCapitalize="sentences"
            multiline
            maxLength={TEXT_LIMITS.post}
            helper={`${text.length}/${TEXT_LIMITS.post}`}
            editable={!saving}
          />

          <View style={styles.imageSection}>
            <View style={styles.imageHeader}>
              <Chip label="Optional image" icon="image-outline" />
              {image ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => {
                    setImage(null);
                    clearMediaError();
                  }}
                />
              ) : null}
            </View>

            {image ? (
              <Image source={{ uri: image.uri }} contentFit="cover" style={styles.imagePreview} />
            ) : null}

            <Button
              label={image ? 'Replace image' : `Add image (max ${formatFileSize(FILE_LIMITS.postImage)})`}
              variant="secondary"
              icon="image-outline"
              onPress={() => void handlePickImage()}
              disabled={saving}
            />
          </View>

          <View style={styles.skillSection}>
            <View style={styles.skillLabel}>
              <Chip label="Optional skill tag" icon="pricetag-outline" />
              {skillTag ? (
                <Button label="Clear" variant="ghost" onPress={() => setSkillTag(null)} />
              ) : null}
            </View>
            <View style={styles.skills}>
              {SKILLS.map((skill) => (
                <Chip
                  key={skill.tag}
                  size="sm"
                  label={skill.label}
                  selected={skillTag === skill.tag}
                  onPress={() => setSkillTag(skillTag === skill.tag ? null : skill.tag)}
                />
              ))}
            </View>
          </View>

          <Notice
            tone="info"
            message="Posts are visible to signed-in SkillBridge members. Be respectful and do not share private information."
          />

          <Button
            label="Publish post"
            icon="send-outline"
            onPress={() => void handlePublish()}
            loading={saving}
            disabled={!text.trim()}
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
  section: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillSection: {
    gap: spacing.sm,
  },
  imageSection: {
    gap: spacing.sm,
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imagePreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  skillLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
