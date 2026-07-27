import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { FolderFormSheet } from '@/features/folders/components/FolderFormSheet';
import { useFolders } from '@/features/folders/hooks/useFolders';
import { folderDepth, sortedByHierarchy } from '@/features/folders/utils/tree';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function FoldersScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(16);
  const { data: folders, isLoading } = useFolders();
  const [formVisible, setFormVisible] = useState(false);

  const ordered = sortedByHierarchy(folders ?? []);

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Pastas" rightIcon="plus" onRightPress={() => setFormVisible(true)} />

      {!isLoading && ordered.length === 0 ? (
        <EmptyState icon="folder" title="Nenhuma pasta ainda" subtitle="Crie pastas para organizar suas notas." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          {ordered.map((folder) => (
            <View key={folder.id}>
              <Pressable
                onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
                className="flex-row items-center justify-between px-4 py-3.5 active:bg-subtle-light dark:active:bg-subtle-dark"
                style={{ paddingLeft: 16 + folderDepth(folder.id, folders ?? []) * 20 }}
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="folder" size={18} color={tokens.muted} />
                  <AppText variant="body">{folder.name}</AppText>
                </View>
                <Feather name="chevron-right" size={18} color={tokens.muted} />
              </Pressable>
              <Divider />
            </View>
          ))}
        </ScrollView>
      )}

      <FolderFormSheet visible={formVisible} onClose={() => setFormVisible(false)} mode="create" parentId={null} />
    </View>
  );
}
