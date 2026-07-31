import type { SQLiteDatabase } from 'expo-sqlite';

import {
  MIGRATION_001_INIT,
  MIGRATION_002_CATEGORIES,
  MIGRATION_003_NOTE_LOOK,
  MIGRATION_004_REVIEW,
  MIGRATION_005_STREAK,
  MIGRATION_006_SHIELDS,
} from '../schema';

type Migration = { version: number; sql: string };

/**
 * A ordem é a da versão, e uma migração já publicada nunca é editada: quem já
 * abriu o app tem `user_version` gravado e não roda de novo o que passou. Mudar
 * o texto de uma migração antiga só afetaria instalações novas, e o banco
 * passaria a ter dois formatos diferentes em campo.
 */
const MIGRATIONS: Migration[] = [
  { version: 1, sql: MIGRATION_001_INIT },
  { version: 2, sql: MIGRATION_002_CATEGORIES },
  { version: 3, sql: MIGRATION_003_NOTE_LOOK },
  { version: 4, sql: MIGRATION_004_REVIEW },
  { version: 5, sql: MIGRATION_005_STREAK },
  { version: 6, sql: MIGRATION_006_SHIELDS },
];

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
