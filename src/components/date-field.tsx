import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { formatLongDate } from '@/lib/dates';

export interface DateFieldProps {
  label: string;
  value: string | null;
  onChange: (isoDate: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateField({ label, value, onChange, maximumDate, minimumDate }: DateFieldProps) {
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00`) : new Date();

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateValue,
        mode: 'date',
        maximumDate,
        minimumDate,
        onChange: (_event, selected) => {
          if (selected) onChange(toISODate(selected));
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
        <ThemedText type="mono">{value ? formatLongDate(value) : 'Select a date'}</ThemedText>
      </Pressable>
      {Platform.OS === 'ios' && showIOSPicker ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="inline"
          themeVariant="dark"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(_event, selected) => {
            if (selected) onChange(toISODate(selected));
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
