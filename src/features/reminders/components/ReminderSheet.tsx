import { useState } from 'react';
import { Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';

import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';
import { weekdayLabel } from '@/utils/date';
import { useClearReminder, useReminder, useSetReminder } from '../hooks/useReminder';

type ReminderSheetProps = {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
};

type Mode = 'menu' | 'datetime' | 'daily' | 'weekly';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 py-3.5">
      <Feather name={icon} size={18} color={danger ? tokens.danger : tokens.ink} />
      <AppText variant="body" className={danger ? 'text-danger' : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ReminderSheet({ visible, onClose, noteId, noteTitle }: ReminderSheetProps) {
  const { data: reminder } = useReminder(noteId);
  const setReminder = useSetReminder(noteId);
  const clearReminder = useClearReminder(noteId);

  const [mode, setMode] = useState<Mode>('menu');
  const [pickerDate, setPickerDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [weekday, setWeekday] = useState(2);

  const closeAndReset = () => {
    setMode('menu');
    onClose();
  };

  const confirmImmediate = (triggerType: 'tomorrow' | 'in30min') => {
    setReminder.mutate({ triggerType, title: noteTitle }, { onSuccess: closeAndReset });
  };

  const confirmDatetime = () => {
    setReminder.mutate({ triggerType: 'datetime', date: pickerDate, title: noteTitle }, { onSuccess: closeAndReset });
  };

  const confirmDaily = () => {
    setReminder.mutate(
      { triggerType: 'daily', hour: pickerDate.getHours(), minute: pickerDate.getMinutes(), title: noteTitle },
      { onSuccess: closeAndReset }
    );
  };

  const confirmWeekly = () => {
    setReminder.mutate(
      {
        triggerType: 'weekly',
        hour: pickerDate.getHours(),
        minute: pickerDate.getMinutes(),
        weekday,
        title: noteTitle,
      },
      { onSuccess: closeAndReset }
    );
  };

  return (
    <Sheet visible={visible} onClose={closeAndReset} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        Lembrete
      </AppText>

      {mode === 'menu' ? (
        <View>
          <MenuRow icon="clock" label="Horário específico" onPress={() => setMode('datetime')} />
          <Divider />
          <MenuRow icon="sun" label="Amanhã de manhã" onPress={() => confirmImmediate('tomorrow')} />
          <Divider />
          <MenuRow icon="zap" label="Daqui 30 minutos" onPress={() => confirmImmediate('in30min')} />
          <Divider />
          <MenuRow icon="repeat" label="Repetir diariamente" onPress={() => setMode('daily')} />
          <Divider />
          <MenuRow icon="calendar" label="Repetir semanalmente" onPress={() => setMode('weekly')} />
          {reminder ? (
            <>
              <Divider />
              <MenuRow
                icon="bell-off"
                label="Remover lembrete"
                danger
                onPress={() => clearReminder.mutate(undefined, { onSuccess: closeAndReset })}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {mode === 'datetime' ? (
        <View className="gap-4 pb-2">
          <DateTimePicker
            value={pickerDate}
            mode="datetime"
            minimumDate={new Date()}
            onChange={(_, date) => date && setPickerDate(date)}
          />
          <Button label="Confirmar lembrete" onPress={confirmDatetime} />
        </View>
      ) : null}

      {mode === 'daily' ? (
        <View className="gap-4 pb-2">
          <DateTimePicker value={pickerDate} mode="time" onChange={(_, date) => date && setPickerDate(date)} />
          <Button label="Confirmar lembrete diário" onPress={confirmDaily} />
        </View>
      ) : null}

      {mode === 'weekly' ? (
        <View className="gap-4 pb-2">
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <Pressable
                key={day}
                onPress={() => setWeekday(day)}
                className={cn('rounded-full px-3 py-2', day === weekday ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark')}
              >
                <AppText className={day === weekday ? 'text-white' : 'text-ink-light dark:text-ink-dark'} variant="small">
                  {weekdayLabel(day).slice(0, 3)}
                </AppText>
              </Pressable>
            ))}
          </View>
          <DateTimePicker value={pickerDate} mode="time" onChange={(_, date) => date && setPickerDate(date)} />
          <Button label="Confirmar lembrete semanal" onPress={confirmWeekly} />
        </View>
      ) : null}
    </Sheet>
  );
}
