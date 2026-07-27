import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function sanitizeFileName(title: string): string {
  const base = title.trim().replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'nota';
  return `${base.slice(0, 60)}.md`;
}

export async function exportNoteAsMarkdown(title: string, content: string): Promise<void> {
  const fileName = sanitizeFileName(title);
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: 'Exportar nota' });
  }
}
