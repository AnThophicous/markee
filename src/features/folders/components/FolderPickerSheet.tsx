import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import { useFolders } from '../hooks/useFolders';
import { folderDepth, sortedByHierarchy } from '../utils/tree';

type FolderPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
};

export function FolderPickerSheet({ visible, onClose, selectedFolderId, onSelect }: FolderPickerSheetProps) {
  const { data: folders } = useFolders();
  const { tokens } = useTheme();
  const ordered = sortedByHierarchy(folders ?? []);

  const choose = (folderId: string | null) => {
    onSelect(folderId);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-2 px-1">
        Mover para pasta
      </AppText>
      <Pressable onPress={() => choose(null)} className="flex-row items-center justify-between py-3">
        <AppText variant="body">Sem pasta</AppText>
        {selectedFolderId === null ? <Feather name="check" size={18} color={tokens.accent} /> : null}
      </Pressable>
      <Divider />
      {ordered.map((folder) => (
        <View key={folder.id}>
          <Pressable onPress={() => choose(folder.id)} className="flex-row items-center justify-between py-3">
            <AppText variant="body" style={{ marginLeft: folderDepth(folder.id, folders ?? []) * 16 }}>
              {folder.name}
            </AppText>
            {selectedFolderId === folder.id ? <Feather name="check" size={18} color={tokens.accent} /> : null}
          </Pressable>
          <Divider />
        </View>
      ))}
    </Sheet>
  );
}
