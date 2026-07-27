import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATION_001_INIT } from '../schema';

type Migration = { version: number; sql: string };

const MIGRATIONS: Migration[] = [{ version: 1, sql: MIGRATION_001_INIT }];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      currentVersion = migration.version;
    }
  }
}
