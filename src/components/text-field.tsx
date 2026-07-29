import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, MinTouchTarget, Radius, Spacing } from '@/constants/theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  mono?: boolean;
};

export function TextField({ label, error, mono = false, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="label" color="muted">
        {label}
      </ThemedText>
      <TextInput
        style={[styles.input, mono && styles.inputMono, style]}
        placeholderTextColor={Colors.dim}
        {...rest}
      />
      {error ? (
        <ThemedText type="label" color="amber">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  input: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
    color: Colors.paper,
    paddingHorizontal: Spacing.lg,
    fontFamily: FontFamily.sans,
    fontSize: 16,
  },
  inputMono: {
    fontFamily: FontFamily.mono,
    letterSpacing: 1,
  },
});
