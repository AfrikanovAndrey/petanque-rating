import { Pool, RowDataPacket } from "mysql2/promise";
import {
  ensureEnumValue,
  formatEnumSql,
  parseEnumValues,
  removeEnumValue,
} from "./enumColumnUtils";

/**
 * Миграция: Разделение типа TET-A-TET на мужской и женский
 *
 * Изменяет ENUM значения для колонки type в таблице tournaments:
 * - Заменяет TET-A-TET на TET_A_TET_MALE и TET_A_TET_FEMALE
 *
 * Важно: при ALTER сохраняются все уже существующие значения ENUM
 * (например DOUBLETTE_ANY, TET_A_TET_ANY), чтобы не получить Data truncated.
 */

async function getTournamentsTypeColumn(
  pool: Pool,
): Promise<string | undefined> {
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'type'
  `);
  return columns[0]?.COLUMN_TYPE as string | undefined;
}

export async function up(pool: Pool): Promise<void> {
  console.log("  🔍 Проверка разделения типа TET-A-TET...");

  const columnType = await getTournamentsTypeColumn(pool);
  if (
    columnType?.includes("'TET_A_TET_MALE'") &&
    !columnType?.includes("'TET-A-TET'")
  ) {
    console.log("  ✅ Типы TET_A_TET_MALE/TET_A_TET_FEMALE уже применены");
    return;
  }

  console.log("  📝 Изменение типов турниров: разделение TET-A-TET...");

  let values = parseEnumValues(columnType);
  if (values.length === 0) {
    values = [
      "TRIPLETTE",
      "DOUBLETTE_MALE",
      "DOUBLETTE_FEMALE",
      "DOUBLETTE_MIXT",
      "TET-A-TET",
    ];
  }

  // Шаг 1: расширяем ENUM, сохраняя старое значение TET-A-TET и все прочие типы
  values = ensureEnumValue(values, "TET-A-TET");
  values = ensureEnumValue(values, "TET_A_TET_MALE");
  values = ensureEnumValue(values, "TET_A_TET_FEMALE");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
  `);
  console.log("  ✅ ENUM расширен");

  // Шаг 2: переносим существующие записи (старый тип без пола -> мужской)
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM tournaments WHERE type = 'TET-A-TET'",
  );
  const tetATetCount = rows[0]?.count as number;

  if (tetATetCount > 0) {
    console.log(
      `  📝 Обновление ${tetATetCount} турниров: TET-A-TET -> TET_A_TET_MALE...`,
    );
    await pool.execute(`
      UPDATE tournaments
      SET type = 'TET_A_TET_MALE'
      WHERE type = 'TET-A-TET'
    `);
    console.log("  ✅ Существующие турниры обновлены");
  }

  // Шаг 3: убираем только устаревшее TET-A-TET, остальные значения сохраняем
  const afterType = await getTournamentsTypeColumn(pool);
  let afterValues = parseEnumValues(afterType);
  afterValues = removeEnumValue(afterValues, "TET-A-TET");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(afterValues)} NOT NULL
  `);

  console.log("  ✅ ENUM обновлён");
  console.log("  ✅ Миграция успешно выполнена");
}

export async function down(pool: Pool): Promise<void> {
  console.log("  📝 Откат миграции: объединение типов тет-а-тет...");

  const columnType = await getTournamentsTypeColumn(pool);
  let values = parseEnumValues(columnType);
  values = ensureEnumValue(values, "TET-A-TET");
  values = ensureEnumValue(values, "TET_A_TET_MALE");
  values = ensureEnumValue(values, "TET_A_TET_FEMALE");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(values)} NOT NULL
  `);

  await pool.execute(`
    UPDATE tournaments
    SET type = 'TET-A-TET'
    WHERE type IN ('TET_A_TET_MALE', 'TET_A_TET_FEMALE')
  `);

  console.log("  ✅ Существующие турниры обновлены на TET-A-TET");

  const afterType = await getTournamentsTypeColumn(pool);
  let afterValues = parseEnumValues(afterType);
  afterValues = removeEnumValue(afterValues, "TET_A_TET_MALE");
  afterValues = removeEnumValue(afterValues, "TET_A_TET_FEMALE");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ${formatEnumSql(afterValues)} NOT NULL
  `);

  console.log("  ✅ ENUM возвращён к исходному виду");
}
