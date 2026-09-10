import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";
import {
  ensureEnumValue,
  formatEnumSql,
  parseEnumValues,
  removeEnumValue,
} from "./enumColumnUtils";

/**
 * Миграция 026: тип турнира TET_A_TET_ANY (тет-а-тет смешанный, любой пол)
 *
 * Добавляет значение в ENUM, сохраняя все уже существующие типы.
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
  console.log("  🔍 Проверка типа TET_A_TET_ANY в tournaments.type...");

  const columnType = await getTournamentsTypeColumn();
  if (columnType?.includes("'TET_A_TET_ANY'")) {
    console.log("  ✅ Тип TET_A_TET_ANY уже добавлен");
    return;
  }

  console.log("  📝 Добавление типа TET_A_TET_ANY в tournaments.type...");
  let values = parseEnumValues(columnType);
  if (values.length === 0) {
    values = [
      "TRIPLETTE",
      "DOUBLETTE_MALE",
      "DOUBLETTE_FEMALE",
      "DOUBLETTE_MIXT",
      "DOUBLETTE_ANY",
      "TET_A_TET_MALE",
      "TET_A_TET_FEMALE",
    ];
  }
  values = ensureEnumValue(values, "TET_A_TET_ANY");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
  `);
  console.log("  ✅ Тип TET_A_TET_ANY успешно добавлен");
}

export async function down(): Promise<void> {
  console.log("  📝 Откат типа TET_A_TET_ANY в tournaments.type...");

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM tournaments WHERE type = 'TET_A_TET_ANY'",
  );
  if ((rows[0]?.count as number) > 0) {
    throw new Error(
      "Невозможно откатить миграцию: есть турниры с типом TET_A_TET_ANY",
    );
  }

  const columnType = await getTournamentsTypeColumn();
  let values = parseEnumValues(columnType);
  values = removeEnumValue(values, "TET_A_TET_ANY");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
  `);
  console.log("  ✅ Тип TET_A_TET_ANY удалён");
}
