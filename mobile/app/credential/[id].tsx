import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { CREDENTIAL_TYPE_LABEL } from '@/components/user/CredentialCard';
import { skillLabel } from '@/constants/skills';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { getCredential, isExpired } from '@/services/credentialService';
import type { Credential } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatDate } from '@/utils/date';
import { formatFileSize } from '@/utils/format';

export default function CredentialViewerScreen() {
  const { id, ownerId } = useLocalSearchParams<{ id: string; ownerId: string }>();

  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !ownerId) {
      setError('This credential link is incomplete.');
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const found = await getCredential(ownerId, id);
        if (active) setCredential(found);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, ownerId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Credential" showBack />
        <LoadingState label="Loading credential…" />
      </SafeAreaView>
    );
  }

  if (error || !credential) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Credential" showBack />
        <ErrorState
          message={error ?? 'This credential is no longer available.'}
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </SafeAreaView>
    );
  }

  const expired = isExpired(credential);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={CREDENTIAL_TYPE_LABEL[credential.type]} showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.document}>
          {credential.fileType === 'image' ? (
            <ZoomableImage
              uri={credential.fileUrl}
              accessibilityLabel={`Document for ${credential.title}. Pinch to zoom.`}
            />
          ) : credential.fileType === 'pdf' ? (
            <EmptyState
              icon="document-text-outline"
              title="PDF document"
              message={`${formatFileSize(credential.fileSizeBytes)} · opens in your browser`}
              actionLabel="Open PDF"
              onAction={() => void WebBrowser.openBrowserAsync(credential.fileUrl)}
            />
          ) : (
            <EmptyState
              icon="document-outline"
              title="No document attached"
              message="This credential was entered without supporting evidence — worth weighing when you decide."
            />
          )}
        </View>

        {credential.fileType === 'image' ? (
          <Text style={styles.zoomHint}>Pinch or double-tap to zoom.</Text>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{credential.title}</Text>
          <Text style={styles.issuer}>{credential.issuer}</Text>

          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="pricetag-outline" size={sizes.iconSm} color={colors.inkMuted} />
              <Text style={styles.tagText}>Backs {skillLabel(credential.skillTag)}</Text>
            </View>
            {expired ? (
              <View style={styles.tag}>
                <Ionicons name="alert-circle-outline" size={sizes.iconSm} color={colors.warning} />
                <Text style={[styles.tagText, styles.expired]}>Expired</Text>
              </View>
            ) : null}
          </View>

          {credential.description ? (
            <Text style={styles.description}>{credential.description}</Text>
          ) : null}

          <Card>
            <Detail label="Issued" value={formatDate(credential.issueDate)} />
            <Detail
              label="Expires"
              value={credential.expiryDate ? formatDate(credential.expiryDate) : 'No expiry'}
            />
            <Detail label="Reference no." value={credential.referenceNo || 'Not supplied'} />
            <Detail
              label="File"
              value={
                credential.fileType === 'none'
                  ? 'None'
                  : `${credential.fileType === 'pdf' ? 'PDF' : 'Image'} · ${formatFileSize(credential.fileSizeBytes)}`
              }
            />
          </Card>

          {credential.verifyUrl ? (
            <Button
              label="Open verification link"
              icon="open-outline"
              onPress={() => void WebBrowser.openBrowserAsync(credential.verifyUrl)}
            />
          ) : null}

          {/*
            The one claim this screen must never overstate. There is no admin panel
            in scope to approve credentials, so the app says who asserted what.
          */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={sizes.iconMd} color={colors.inkMuted} />
            <Text style={styles.disclaimerText}>
              Self-declared. These details were entered by the member and have not been checked by
              SkillBridge.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  document: {
    height: sizes.preview,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
  },
  zoomHint: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
  body: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.ink,
  },
  issuer: {
    ...type.body,
    color: colors.inkMuted,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tagText: {
    ...type.label,
    color: colors.inkMuted,
  },
  expired: {
    color: colors.warning,
  },
  description: {
    ...type.body,
    color: colors.ink,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...type.label,
    color: colors.inkMuted,
  },
  detailValue: {
    ...type.bodyStrong,
    color: colors.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  disclaimerText: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
});
