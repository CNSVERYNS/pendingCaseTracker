import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { FORM_TYPE_LABELS } from '@/lib/form-type';
import { maskReceiptNumber } from '@/lib/receipt';
import type { FormType } from '@/lib/database.types';

export interface HomeHeaderProps {
  formType: FormType;
  officeLabel: string | null;
  receiptNumber: string;
}

function OverflowMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.menuButton}
        accessibilityRole="button"
        accessibilityLabel="More options"
      >
        <ThemedText type="mono" color="muted">
          •••
        </ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <ThemedView background="surface" style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setOpen(false);
                router.push('/cases');
              }}
            >
              <ThemedText type="body">{strings.menu.allCases}</ThemedText>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setOpen(false);
                router.push('/settings');
              }}
            >
              <ThemedText type="body">{strings.menu.settings}</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

export function HomeHeader({ formType, officeLabel, receiptNumber }: HomeHeaderProps) {
  return (
    <View>
      <View style={styles.wordmarkRow}>
        <ThemedText type="mono" color="muted" style={styles.wordmark}>
          PENDING
        </ThemedText>
        <OverflowMenu />
      </View>

      <View style={styles.caseRow}>
        <ThemedText type="monoMedium" color="amber">
          {formType}
        </ThemedText>
      </View>
      <ThemedText type="title">{FORM_TYPE_LABELS[formType]}</ThemedText>
      <ThemedText type="mono" color="dim" style={styles.subline}>
        {maskReceiptNumber(receiptNumber)}
        {officeLabel ? ` · ${officeLabel}` : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    letterSpacing: 3,
  },
  menuButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 64,
    paddingRight: Spacing.xl,
  },
  menu: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    minWidth: 180,
    overflow: 'hidden',
  },
  menuItem: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.hairline,
  },
  caseRow: {
    marginTop: Spacing.lg,
  },
  subline: {
    marginTop: Spacing.xs,
  },
});
