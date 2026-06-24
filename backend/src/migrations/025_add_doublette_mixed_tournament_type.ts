import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";

/**
 * Миграция 025: тип турнира DOUBLETTE_ANY (дуплеты смешанные, любой состав)
 */

export async function up(): Promise<void> {
  console.log("  🔍 Проверка типа DOUBLETTE_ANY в tournaments.type...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'type'
  `);

  const columnType = columns[0]?.COLUMN_TYPE as string | undefined;
  if (columnType?.includes("'DOUBLETTE_ANY'")) {
    console.log("  ✅ Тип DOUBLETTE_ANY уже добавлен");
    return;
  }

  console.log("  📝 Добавление типа DOUBLETTE_ANY в tournaments.type...");
  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ENUM(
      'TRIPLETTE',
      'DOUBLETTE_MALE',
      'DOUBLETTE_FEMALE',
      'DOUBLETTE_MIXT',
      'DOUBLETTE_ANY',
      'TET_A_TET_MALE',
      'TET_A_TET_FEMALE'
    ) NOT NULL
  `);
  console.log("  ✅ Тип DOUBLETTE_ANY успешно добавлен");
}

export async function down(): Promise<void> {
  console.log("  📝 Откат типа DOUBLETTE_ANY в tournaments.type...");

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM tournaments WHERE type = 'DOUBLETTE_ANY'",
  );
  if ((rows[0]?.count as number) > 0) {
    throw new Error(
      "Невозможно откатить миграцию: есть турниры с типом DOUBLETTE_ANY",
    );
  }

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ENUM(
      'TRIPLETTE',
      'DOUBLETTE_MALE',
      'DOUBLETTE_FEMALE',
      'DOUBLETTE_MIXT',
      'TET_A_TET_MALE',
      'TET_A_TET_FEMALE'
    ) NOT NULL
  `);
  console.log("  ✅ Тип DOUBLETTE_ANY удалён");
}
