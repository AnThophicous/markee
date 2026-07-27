import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteReminderByNoteId,
  getReminderByNoteId,
  saveReminder,
} from '../services/reminders.service';
import { cancelReminder, ensureNotificationPermission, scheduleReminder, type TriggerSpec } from '../services/notifications';

function reminderKey(noteId: string) {
  return ['reminders', noteId] as const;
}

export function useReminder(noteId: string) {
  return useQuery({
    queryKey: reminderKey(noteId),
    queryFn: () => getReminderByNoteId(noteId),
  });
}

export function useSetReminder(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TriggerSpec & { title: string }) => {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        throw new Error('Permissão de notificações negada');
      }

      const previous = await getReminderByNoteId(noteId);
      if (previous?.notificationId) {
        await cancelReminder(previous.notificationId);
      }

      const scheduled = await scheduleReminder({ ...input, noteId });
      return saveReminder({
        noteId,
        triggerType: input.triggerType,
        triggerAt: scheduled.triggerAt,
        repeatHour: scheduled.repeatHour,
        repeatMinute: scheduled.repeatMinute,
        repeatWeekday: scheduled.repeatWeekday,
        notificationId: scheduled.notificationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKey(noteId) });
      queryClient.invalidateQueries({ queryKey: ['reminders', 'upcoming'] });
    },
  });
}

export function useClearReminder(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const existing = await deleteReminderByNoteId(noteId);
      if (existing?.notificationId) {
        await cancelReminder(existing.notificationId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKey(noteId) });
      queryClient.invalidateQueries({ queryKey: ['reminders', 'upcoming'] });
    },
  });
}
