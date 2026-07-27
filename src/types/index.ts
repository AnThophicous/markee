export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  /** Categoria da nota. Nula enquanto ninguém escolheu uma. */
  categoryId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type Category = {
  id: string;
  name: string;
  /** Hexadecimal. A mesma paleta dos gráficos, conferida para daltonismo. */
  color: string;
  /** Nome do ícone do Feather. */
  icon: string;
  position: number;
  createdAt: number;
};

export type NoteWithTags = Note & { tags: string[] };

export type Tag = {
  id: string;
  name: string;
};

export type ReminderTriggerType = 'datetime' | 'tomorrow' | 'in30min' | 'daily' | 'weekly';

export type Reminder = {
  id: string;
  noteId: string;
  triggerType: ReminderTriggerType;
  triggerAt: number | null;
  repeatHour: number | null;
  repeatMinute: number | null;
  repeatWeekday: number | null;
  notificationId: string | null;
  createdAt: number;
};
