import { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

type EventSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; description?: string; startsAt: Date }) => void;
  isPending: boolean;
};

const QUICK = [
  { label: 'Amanhã 19h', days: 1, hour: 19 },
  { label: 'Sábado 10h', days: null, hour: 10 },
  { label: 'Semana que vem', days: 7, hour: 19 },
];

function nextSaturday(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function EventSheet({ visible, onClose, onCreate, isPending }: EventSheetProps) {
  const { tokens } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => defaultDate());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setStartsAt(defaultDate());
    setPickerMode(null);
  }, [visible]);

  const submit = () => {
    if (!title.trim()) return;
    onCreate({ title, description, startsAt });
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-1 px-1">
        Novo evento
      </AppText>
      <AppText variant="caption" className="mb-3 px-1">
        Prova, entrega de trabalho ou sessão de estudo da turma.
      </AppText>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Prova de Cálculo II"
        placeholderTextColor={tokens.muted}
        autoFocus
        className="mb-2 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
      />

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Detalhes (opcional)"
        placeholderTextColor={tokens.muted}
        multiline
        className="mb-3 min-h-[64px] rounded-xl bg-subtle-light px-4 py-3 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        style={{ textAlignVertical: 'top' }}
      />

      <View className="mb-3 flex-row flex-wrap gap-2">
        {QUICK.map((option) => (
          <Pressable
            key={option.label}
            onPress={() => setStartsAt(option.days === null ? nextSaturday(option.hour) : inDays(option.days, option.hour))}
            className="rounded-full bg-subtle-light px-3.5 py-2 active:opacity-70 dark:bg-subtle-dark"
          >
            <AppText variant="small" className="text-ink-light dark:text-ink-dark">
              {option.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View className="mb-4 flex-row gap-2">
        <Pressable
          onPress={() => setPickerMode('date')}
          className="flex-1 flex-row items-center gap-2 rounded-xl bg-subtle-light px-4 py-3 dark:bg-subtle-dark"
        >
          <Feather name="calendar" size={16} color={tokens.accent} />
          <AppText variant="body">{startsAt.toLocaleDateString('pt-BR')}</AppText>
        </Pressable>
        <Pressable
          onPress={() => setPickerMode('time')}
          className="flex-row items-center gap-2 rounded-xl bg-subtle-light px-4 py-3 dark:bg-subtle-dark"
        >
          <Feather name="clock" size={16} color={tokens.accent} />
          <AppText variant="body">
            {startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </AppText>
        </Pressable>
      </View>

      {pickerMode ? (
        <DateTimePicker
          value={startsAt}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={pickerMode === 'date' ? new Date() : undefined}
          onChange={(event, date) => {
            setPickerMode(null);
            if (event.type === 'set' && date) setStartsAt(date);
          }}
        />
      ) : null}

      <Button
        label={isPending ? 'Salvando…' : 'Marcar evento'}
        onPress={submit}
        disabled={isPending || !title.trim()}
        className={title.trim() ? undefined : 'opacity-50'}
      />
    </Sheet>
  );
}

function defaultDate(): Date {
  return inDays(1, 19);
}

function inDays(days: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}
