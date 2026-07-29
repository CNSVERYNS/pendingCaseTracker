import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MinTouchTarget, ScreenMargin, Spacing } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { FORM_TYPE_LABELS } from '@/lib/form-type';
import type { CaseListItem } from '@/lib/use-cases-list';
import { useCasesList } from '@/lib/use-cases-list';

function CaseRow({ item }: { item: CaseListItem }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/case/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.nickname ?? FORM_TYPE_LABELS[item.formType]}, ${item.days} days, ${item.currentStepTitle}`}
    >
      <ThemedText type="monoMedium" color="amber">
        {item.formType}
      </ThemedText>
      <View style={styles.rowContent}>
        <ThemedText type="bodyMedium" numberOfLines={1}>
          {item.nickname ?? FORM_TYPE_LABELS[item.formType]}
        </ThemedText>
        <ThemedText type="label" color="muted" numberOfLines={1}>
          {item.currentStepTitle}
        </ThemedText>
      </View>
      <ThemedText type="mono" color="muted">
        {item.days}
        {strings.cases.daysSuffix}
      </ThemedText>
    </Pressable>
  );
}

export default function CasesListScreen() {
  const { data, isLoading } = useCasesList();

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <ThemedText type="title">{strings.cases.title}</ThemedText>
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={strings.cases.addCase}
          >
            <ThemedText type="title" color="amber">
              +
            </ThemedText>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CaseRow item={item} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: ScreenMargin,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  addButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: Spacing.xxl,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.md,
  },
  rowContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.hairline,
  },
});
