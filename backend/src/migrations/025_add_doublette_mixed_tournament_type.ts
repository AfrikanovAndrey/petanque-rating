import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";
import {
  ensureEnumValue,
  formatEnumSql,
  parseEnumValues,
  removeEnumValue,
} from "./enumColumnUtils";

/**
 * Миграция 025: тип турнира DOUBLETTE_ANY (дуплеты смешанные, любой состав)
 *
 * Добавляет значение в ENUM, сохраняя все уже существующие типы
 * (в т.ч. добавленные более поздними миграциями).
 */

async function getTournamentsTypeColumn(): Promise<string | undefined> {
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'type'
  `);
  return columns[0]?.COLUMN_TYPE as string | undefined;
}

export async function up(): Promise<void> {
  console.log("  🔍 Проверка типа DOUBLETTE_ANY в tournaments.type...");

  const columnType = await getTournamentsTypeColumn();
  if (columnType?.includes("'DOUBLETTE_ANY'")) {
    console.log("  ✅ Тип DOUBLETTE_ANY уже добавлен");
    return;
  }

  console.log("  📝 Добавление типа DOUBLETTE_ANY в tournaments.type...");
  let values = parseEnumValues(columnType);
  if (values.length === 0) {
    values = [
      "TRIPLETTE",
      "DOUBLETTE_MALE",
      "DOUBLETTE_FEMALE",
      "DOUBLETTE_MIXT",
      "TET_A_TET_MALE",
      "TET_A_TET_FEMALE",
    ];
  }
  values = ensureEnumValue(values, "DOUBLETTE_ANY");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
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

  const columnType = await getTournamentsTypeColumn();
  let values = parseEnumValues(columnType);
  values = removeEnumValue(values, "DOUBLETTE_ANY");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
  `);
  console.log("  ✅ Тип DOUBLETTE_ANY удалён");
}
