import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import { NOTE_TEMPLATES, type NoteTemplate } from '../templates';

type NewNoteSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPickBlank: () => void;
  onPickTemplate: (template: NoteTemplate) => void;
};

export function NewNoteSheet({ visible, onClose, onPickBlank, onPickTemplate }: NewNoteSheetProps) {
  const { tokens } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-1 px-1">
        Começar de onde?
      </AppText>
      <AppText variant="caption" className="mb-3 px-1">
        O botão + sozinho já abre uma nota em branco.
      </AppText>

      <ScrollView className="max-h-[420px]">
        <Pressable onPress={onPickBlank} className="flex-row items-center gap-3 py-3 active:opacity-60">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Feather name="file-text" size={17} color="#fff" />
          </View>
          <View className="flex-1">
            <AppText variant="body">Nota em branco</AppText>
            <AppText variant="small">Só o cursor e você</AppText>
          </View>
        </Pressable>

        <Divider />

        {NOTE_TEMPLATES.map((template, index) => (
          <View key={template.id}>
            <Pressable
              onPress={() => onPickTemplate(template)}
              className="flex-row items-center gap-3 py-3 active:opacity-60"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-subtle-light dark:bg-subtle-dark">
                <Feather name={template.icon} size={17} color={tokens.ink} />
              </View>
              <View className="flex-1">
                <AppText variant="body">{template.label}</AppText>
                <AppText variant="small">{template.hint}</AppText>
              </View>
            </Pressable>
            {index < NOTE_TEMPLATES.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}
