import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { formatTime12h } from '@/lib/dates';

export interface TimeFieldProps {
  label: string;
  value: string | null;
  onChange: (hhmm: string) => void;
}

function toHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const timeValue = value ? new Date(`1970-01-01T${value}:00`) : new Date();

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeValue,
        mode: 'time',
        onChange: (_event, selected) => {
          if (selected) onChange(toHHMM(selected));
        },
      });
    } else {
      setShowIOSPicker((v) => !v);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText type="label" color="muted">
        {label}
      </ThemedText>
      <Pressable style={styles.field} onPress={openPicker} accessibilityRole="button">
        <ThemedText type="mono">{value ? formatTime12h(value) : 'Select a time'}</ThemedText>
      </Pressable>
      {Platform.OS === 'ios' && showIOSPicker ? (
        <DateTimePicker
          value={timeValue}
          mode="time"
          display="spinner"
          themeVariant="dark"
          onChange={(_event, selected) => {
            if (selected) onChange(toHHMM(selected));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  field: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
});
