import type { Folder } from '@/types';

export function folderDepth(id: string, folders: Folder[]): number {
  const map = new Map(folders.map((folder) => [folder.id, folder]));
  let depth = 0;
  let current = map.get(id);
  while (current?.parentId) {
    depth += 1;
    current = map.get(current.parentId);
  }
  return depth;
}

/** Depth-first order: parents before children, siblings alphabetical. */
export function sortedByHierarchy(folders: Folder[]): Folder[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: Folder[] = [];
  const visit = (parentId: string | null) => {
    for (const folder of byParent.get(parentId) ?? []) {
      result.push(folder);
      visit(folder.id);
    }
  };
  visit(null);
  return result;
}

export function descendantIds(id: string, folders: Folder[]): string[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  }

  const result: string[] = [];
  const visit = (parentId: string) => {
    for (const child of byParent.get(parentId) ?? []) {
      result.push(child.id);
      visit(child.id);
    }
  };
  visit(id);
  return result;
}
