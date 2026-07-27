import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useTags } from '@/features/tags/hooks/useTags';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function TagsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(16);
  const { data: tags, isLoading } = useTags();

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Tags" />

      {!isLoading && (tags ?? []).length === 0 ? (
        <EmptyState icon="hash" title="Nenhuma tag ainda" subtitle="Escreva #tag em qualquer nota para criar uma." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          {(tags ?? []).map((tag) => (
            <View key={tag.id}>
              <Pressable
                onPress={() => router.push({ pathname: '/tag/[name]', params: { name: tag.name } })}
                className="flex-row items-center justify-between px-4 py-3.5 active:bg-subtle-light dark:active:bg-subtle-dark"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="hash" size={18} color={tokens.muted} />
                  <AppText variant="body">{tag.name}</AppText>
                </View>
                <AppText variant="caption">{tag.noteCount}</AppText>
              </Pressable>
              <Divider />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
