import { router } from 'expo-router';
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
import { TEXT_LIMITS } from '@/constants/config';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createPost } from '@/services/postService';
import type { PostType } from '@/types';
import { errorMessage } from '@/utils/authErrors';

const POST_TYPES: { value: PostType; label: string; icon: 'trophy-outline' | 'bulb-outline' | 'help-circle-outline' }[] = [
  { value: 'achievement', label: 'Achievement', icon: 'trophy-outline' },
  { value: 'tip', label: 'Tip', icon: 'bulb-outline' },
  { value: 'question', label: 'Question', icon: 'help-circle-outline' },
];

/** Text-only composer. Post images are deliberately deferred until this core flow is stable. */
export default function CreatePostScreen() {
  const { profile } = useAuth();
  const [postType, setPostType] = useState<PostType>('tip');
  const [text, setText] = useState('');
  const [skillTag, setSkillTag] = useState<SkillTag | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  async function handlePublish() {
    const author = profile;
    if (!author || saving) return;

    setSaving(true);
    setError(null);
    try {
      await createPost(author, { type: postType, text, skillTag });
      // Returning preserves Community's active Feed tab; its focus listener
      // refreshes the list and shows the new post immediately.
      router.back();
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setSaving(false);
    }
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
