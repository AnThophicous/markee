import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { IconButton } from '@/components/IconButton';
import { Sheet } from '@/components/Sheet';
import { FolderPickerSheet } from '@/features/folders/components/FolderPickerSheet';
import { useFolders } from '@/features/folders/hooks/useFolders';
import { NoteList } from '@/features/notes/components/NoteList';
import { useSearchNotes } from '@/features/notes/hooks/useNotes';
import { useTags } from '@/features/tags/hooks/useTags';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';

const DATE_FILTERS = [
  { key: 'all', label: 'Qualquer data', days: null },
  { key: 'today', label: 'Hoje', days: 1 },
  { key: 'week', label: '7 dias', days: 7 },
  { key: 'month', label: '30 dias', days: 30 },
] as const;

type DateFilterKey = (typeof DATE_FILTERS)[number]['key'];

export default function SearchScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(16);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [folderSheetVisible, setFolderSheetVisible] = useState(false);

  const { data: tags } = useTags();
  const { data: folders } = useFolders();
  const { data: results, isLoading } = useSearchNotes(debouncedQuery, {
    tagName: tagFilter,
    folderId: folderFilter ?? undefined,
  });

  const filteredResults = useMemo(() => {
    const active = DATE_FILTERS.find((filter) => filter.key === dateFilter);
    if (!active?.days || !results) return results;
    const threshold = Date.now() - active.days * 24 * 60 * 60 * 1000;
    return results.filter((note) => note.updatedAt >= threshold);
  }, [results, dateFilter]);

  const folderName = folders?.find((item) => item.id === folderFilter)?.name;

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <View className="flex-row items-center gap-2 px-2 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <IconButton name="chevron-left" onPress={() => router.back()} />
        <View className="flex-1 flex-row items-center gap-2 rounded-xl bg-subtle-light dark:bg-subtle-dark px-3 py-2.5">
          <Feather name="search" size={16} color={tokens.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título, conteúdo, tag..."
            placeholderTextColor={tokens.muted}
            autoFocus
            className="flex-1 text-[16px] text-ink-light dark:text-ink-dark"
          />
        </View>
      </View>

      <View className="flex-row gap-2 px-3 pb-2">
        <Pressable
          onPress={() => setTagSheetVisible(true)}
          className={cn('rounded-full px-3 py-1.5', tagFilter ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark')}
        >
          <AppText variant="small" className={tagFilter ? 'text-white' : 'text-ink-light dark:text-ink-dark'}>
            {tagFilter ? `#${tagFilter}` : 'Tag'}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setFolderSheetVisible(true)}
          className={cn('rounded-full px-3 py-1.5', folderFilter ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark')}
        >
          <AppText variant="small" className={folderFilter ? 'text-white' : 'text-ink-light dark:text-ink-dark'}>
            {folderFilter ? folderName ?? 'Pasta' : 'Pasta'}
          </AppText>
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-3 pb-3">
        {DATE_FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setDateFilter(filter.key)}
            className={cn('rounded-full px-3 py-1.5', dateFilter === filter.key ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark')}
          >
            <AppText variant="small" className={dateFilter === filter.key ? 'text-white' : 'text-ink-light dark:text-ink-dark'}>
              {filter.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {query.trim().length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <AppText variant="caption" className="text-center">
            Digite para buscar em títulos, conteúdo e tags.
          </AppText>
        </View>
      ) : (
        <NoteList
          notes={filteredResults}
          isLoading={isLoading}
          emptyTitle="Nada encontrado"
          bottomInset={bottom}
        />
      )}

      <Sheet visible={tagSheetVisible} onClose={() => setTagSheetVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-2 px-1">
          Filtrar por tag
        </AppText>
        <Pressable
          onPress={() => {
            setTagFilter(undefined);
            setTagSheetVisible(false);
          }}
          className="py-3"
        >
          <AppText variant="body">Todas as tags</AppText>
        </Pressable>
        <Divider />
        {(tags ?? []).map((tag) => (
          <View key={tag.id}>
            <Pressable
              onPress={() => {
                setTagFilter(tag.name);
                setTagSheetVisible(false);
              }}
              className="py-3"
            >
              <AppText variant="body">#{tag.name}</AppText>
            </Pressable>
            <Divider />
          </View>
        ))}
      </Sheet>

      <FolderPickerSheet
        visible={folderSheetVisible}
        onClose={() => setFolderSheetVisible(false)}
        selectedFolderId={folderFilter}
        onSelect={setFolderFilter}
      />
    </View>
  );
}
