import * as Notifications from 'expo-notifications';

import { minutesFromNow, nextDailyOccurrence, nextWeeklyOccurrence, startOfTomorrowAt } from '@/utils/date';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export type TriggerSpec =
  | { triggerType: 'datetime'; date: Date }
  | { triggerType: 'tomorrow' }
  | { triggerType: 'in30min' }
  | { triggerType: 'daily'; hour: number; minute: number }
  | { triggerType: 'weekly'; hour: number; minute: number; weekday: number };

export type ScheduleInput = TriggerSpec & { title: string; noteId: string };

export type ScheduleResult = {
  notificationId: string;
  triggerAt: number | null;
  repeatHour: number | null;
  repeatMinute: number | null;
  repeatWeekday: number | null;
};

export async function scheduleReminder(input: ScheduleInput): Promise<ScheduleResult> {
  const content = {
    title: input.title || 'Nota sem título',
    body: 'Lembrete do Markee',
    data: { noteId: input.noteId },
  };

  if (input.triggerType === 'in30min') {
    const date = minutesFromNow(30);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    return { notificationId, triggerAt: date.getTime(), repeatHour: null, repeatMinute: null, repeatWeekday: null };
  }

  if (input.triggerType === 'tomorrow') {
    const date = startOfTomorrowAt(9, 0);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    return { notificationId, triggerAt: date.getTime(), repeatHour: null, repeatMinute: null, repeatWeekday: null };
  }

  if (input.triggerType === 'datetime') {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.date },
    });
    return {
      notificationId,
      triggerAt: input.date.getTime(),
      repeatHour: null,
      repeatMinute: null,
      repeatWeekday: null,
    };
  }

  if (input.triggerType === 'daily') {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: input.hour, minute: input.minute },
    });
    return {
      notificationId,
      triggerAt: nextDailyOccurrence(input.hour, input.minute).getTime(),
      repeatHour: input.hour,
      repeatMinute: input.minute,
      repeatWeekday: null,
    };
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: input.weekday,
      hour: input.hour,
      minute: input.minute,
    },
  });
  return {
    notificationId,
    triggerAt: nextWeeklyOccurrence(input.weekday, input.hour, input.minute).getTime(),
    repeatHour: input.hour,
    repeatMinute: input.minute,
    repeatWeekday: input.weekday,
  };
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
