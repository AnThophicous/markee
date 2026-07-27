import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import { useCreateFolder, useRenameFolder } from '../hooks/useFolders';

type FolderFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'rename';
  initialName?: string;
  parentId?: string | null;
  folderId?: string;
};

export function FolderFormSheet({
  visible,
  onClose,
  mode,
  initialName = '',
  parentId = null,
  folderId,
}: FolderFormSheetProps) {
  const { tokens } = useTheme();
  const [name, setName] = useState(initialName);
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === 'create') {
      createFolder.mutate({ name: trimmed, parentId }, { onSuccess: onClose });
    } else if (folderId) {
      renameFolder.mutate({ id: folderId, name: trimmed }, { onSuccess: onClose });
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        {mode === 'create' ? 'Nova pasta' : 'Renomear pasta'}
      </AppText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nome da pasta"
        placeholderTextColor={tokens.muted}
        autoFocus
        onSubmitEditing={handleConfirm}
        className="mb-4 rounded-xl bg-subtle-light dark:bg-subtle-dark px-4 py-3 text-[16px] text-ink-light dark:text-ink-dark"
      />
      <Button label="Salvar" onPress={handleConfirm} />
    </Sheet>
  );
}
