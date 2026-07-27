import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { NoteList } from '@/features/notes/components/NoteList';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useBottomInset } from '@/hooks/useBottomInset';

export default function TagDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const bottom = useBottomInset(16);
  const { data: notes, isLoading } = useNotes({ tagName: name });

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title={`#${name ?? ''}`} showMenu={false} onBackPress={() => router.back()} />
      <NoteList notes={notes} isLoading={isLoading} emptyTitle="Nenhuma nota com esta tag" bottomInset={bottom} />
    </View>
  );
}
