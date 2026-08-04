import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Shown under the field. Validate on blur, not on every keystroke. */
  error?: string | null;
  helper?: string;
  secure?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  onBlur?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secure = false,
  icon,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  multiline = false,
  maxLength,
  editable = true,
  onBlur,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={sizes.iconMd}
            color={error ? colors.danger : colors.inkMuted}
          />
        ) : null}

        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={sizes.iconMd}
              color={colors.inkMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    minHeight: sizes.avatarLg,
    textAlignVertical: 'top',
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
