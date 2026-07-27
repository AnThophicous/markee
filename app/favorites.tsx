import { View } from 'react-native';

import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { NoteList } from '@/features/notes/components/NoteList';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useBottomInset } from '@/hooks/useBottomInset';

export default function FavoritesScreen() {
  const bottom = useBottomInset(16);
  const { data: notes, isLoading } = useNotes({ favoritesOnly: true });

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Favoritos" />
      <NoteList
        notes={notes}
        isLoading={isLoading}
        emptyTitle="Nenhum favorito ainda"
        emptySubtitle="Deslize uma nota para a esquerda e toque na estrela."
        bottomInset={bottom}
      />
    </View>
  );
}
