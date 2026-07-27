export function now(): number {
  return Date.now();
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isSameDay = date.toDateString() === today.toDateString();
  if (isSameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }

  const isSameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: isSameYear ? undefined : 'numeric',
  });
}

export function startOfTomorrowAt(hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function nextDailyOccurrence(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/** weekday follows expo-notifications convention: 1 = Sunday ... 7 = Saturday. */
export function nextWeeklyOccurrence(weekday: number, hour: number, minute: number): Date {
  const date = new Date();
  const currentWeekday = date.getDay() + 1;
  let diff = weekday - currentWeekday;
  if (diff < 0) diff += 7;
  date.setDate(date.getDate() + diff);
  date.setHours(hour, minute, 0, 0);
  if (diff === 0 && date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 7);
  }
  return date;
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? '';
}
