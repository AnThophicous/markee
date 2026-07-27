import { getDb } from '@/database/client';
import type { Reminder, ReminderTriggerType } from '@/types';
import { generateId } from '@/utils/id';
import { now } from '@/utils/date';

type ReminderRow = {
  id: string;
  note_id: string;
  trigger_type: string;
  trigger_at: number | null;
  repeat_hour: number | null;
  repeat_minute: number | null;
  repeat_weekday: number | null;
  notification_id: string | null;
  created_at: number;
};

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    noteId: row.note_id,
    triggerType: row.trigger_type as ReminderTriggerType,
    triggerAt: row.trigger_at,
    repeatHour: row.repeat_hour,
    repeatMinute: row.repeat_minute,
    repeatWeekday: row.repeat_weekday,
    notificationId: row.notification_id,
    createdAt: row.created_at,
  };
}

export type ReminderInput = {
  noteId: string;
  triggerType: ReminderTriggerType;
  triggerAt: number | null;
  repeatHour: number | null;
  repeatMinute: number | null;
  repeatWeekday: number | null;
  notificationId: string | null;
};

export async function getReminderByNoteId(noteId: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE note_id = ?', noteId);
  return row ? mapReminder(row) : null;
}

export async function saveReminder(input: ReminderInput): Promise<Reminder> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE note_id = ?', input.noteId);
  const id = generateId();
  const timestamp = now();
  await db.runAsync(
    `INSERT INTO reminders
       (id, note_id, trigger_type, trigger_at, repeat_hour, repeat_minute, repeat_weekday, notification_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.noteId,
    input.triggerType,
    input.triggerAt,
    input.repeatHour,
    input.repeatMinute,
    input.repeatWeekday,
    input.notificationId,
    timestamp
  );
  return {
    id,
    noteId: input.noteId,
    triggerType: input.triggerType,
    triggerAt: input.triggerAt,
    repeatHour: input.repeatHour,
    repeatMinute: input.repeatMinute,
    repeatWeekday: input.repeatWeekday,
    notificationId: input.notificationId,
    createdAt: timestamp,
  };
}

export async function deleteReminderByNoteId(noteId: string): Promise<Reminder | null> {
  const existing = await getReminderByNoteId(noteId);
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE note_id = ?', noteId);
  return existing;
}

export async function listUpcomingReminders(): Promise<Array<Reminder & { noteTitle: string }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow & { note_title: string }>(
    `SELECT r.*, n.title as note_title FROM reminders r
     JOIN notes n ON n.id = r.note_id
     WHERE n.is_deleted = 0
     ORDER BY r.trigger_at ASC`
  );
  return rows.map((row) => ({ ...mapReminder(row), noteTitle: row.note_title || 'Sem título' }));
}
