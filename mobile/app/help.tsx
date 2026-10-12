import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type Section = { icon: IconName; color: string; title: string; points: string[] };

const SECTIONS: Section[] = [
  {
    icon: 'people-outline',
    color: brand.blue,
    title: 'Community guidelines',
    points: [
      'Be respectful in chats, posts, comments and reviews. No harassment, hate or spam.',
      'Teach what you genuinely know, and describe your sessions and lessons honestly.',
      'Keep sessions on topic and turn up on time. Cancel early if you can’t make it.',
      'Leave fair reviews about the session or lesson, not about the person.',
      'Only share content you have the right to share.',
    ],
  },
  {
    icon: 'checkmark-circle-outline',
    color: brand.green,
    title: 'What “verified” means',
    points: [
      'A filled ✓ tick on a skill means the member passed SkillBridge’s own skill test for that skill and level.',
      'A document icon means the member uploaded a certificate or other proof. Uploaded credentials are self-declared — SkillBridge does not check them, so open them and judge for yourself.',
      'The two signals are separate on purpose: a test result and an uploaded document are different kinds of evidence.',
    ],
  },
  {
    icon: 'lock-closed-outline',
    color: colors.accent,
    title: 'Your data and privacy',
    points: [
      'We store your account (name, email), profile, skills and career goals, credentials you upload, lessons, bookings, chat messages, posts and reviews, and your learning progress.',
      'Signed-in members can see your public profile, offered skills, public credentials, posts and reviews. Private credentials are visible only to you.',
      'Chat messages are visible only to the two people in the chat.',
      'If you allow notifications, we store a device token so we can send you booking, message, review and comment alerts. Logging out removes it.',
      'Data is stored in Google Firebase. SkillBridge does not sell or share your data.',
    ],
  },
  {
    icon: 'help-buoy-outline',
    color: brand.navy,
    title: 'Getting help',
    points: [
      'To report a problem, inappropriate content or a member, contact the SkillBridge project team through your campus course group.',
      'To change your details, use Me → Edit profile. To delete your account and data, ask the project team.',
    ],
  },
];

/** Help, safety and privacy (plan: "Small completeness improvements" #1). Public: linked from registration. */
export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Help & privacy" subtitle="How SkillBridge works and how we treat your data." showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name={section.icon} size={sizes.iconLg} color={section.color} />
              <Text style={styles.cardTitle} accessibilityRole="header">
                {section.title}
              </Text>
            </View>
            {section.points.map((point) => (
              <View key={point} style={styles.point}>
                <Text style={[styles.bullet, { color: section.color }]}>•</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.footer}>SkillBridge — a SLIIT campus project (SDG 4 & 8).</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.lg, padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.h2, color: colors.ink, flex: 1 },
  point: { flexDirection: 'row', gap: spacing.sm },
  bullet: { ...type.bodyStrong },
  pointText: { ...type.body, color: colors.inkMuted, flex: 1 },
  footer: { ...type.caption, color: colors.inkFaint, textAlign: 'center' },
});
