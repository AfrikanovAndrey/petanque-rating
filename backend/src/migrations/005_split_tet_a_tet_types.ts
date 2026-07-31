import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: Разделение типа TET-A-TET на мужской и женский
 *
 * Изменяет ENUM значения для колонки type в таблице tournaments:
 * - Заменяет TET-A-TET на TET_A_TET_MALE и TET_A_TET_FEMALE
 *
 * Идемпотентна: не сужает ENUM, если в схеме уже есть более новые значения
 * (например DOUBLETTE_ANY / TET_A_TET_ANY) или разделение уже применено.
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  📝 Изменение типов турниров: разделение TET-A-TET...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'type'
  `);

  const columnType = String(columns[0]?.COLUMN_TYPE ?? "");

  // Уже разделено (и возможно расширено позже) — не трогаем ENUM
  if (
    columnType.includes("'TET_A_TET_MALE'") &&
    columnType.includes("'TET_A_TET_FEMALE'")
  ) {
    console.log("  ✅ Типы TET_A_TET_MALE/FEMALE уже есть — пропуск");
    return;
  }

  // Сохраняем существующие значения ENUM и добавляем недостающие
  const existing = [...columnType.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const next = Array.from(
    new Set([
      ...existing.filter((v) => v !== "TET-A-TET"),
      "TET_A_TET_MALE",
      "TET_A_TET_FEMALE",
      ...(existing.includes("TET-A-TET") ? ["TET-A-TET"] : []),
    ])
  );

  const enumSql = next.map((v) => `'${v}'`).join(", ");

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN type ENUM(${enumSql}) NOT NULL
  `);

  if (existing.includes("TET-A-TET")) {
    await pool.execute(`
      UPDATE tournaments
      SET type = 'TET_A_TET_MALE'
      WHERE type = 'TET-A-TET'
    `);

    const withoutLegacy = next.filter((v) => v !== "TET-A-TET");
    await pool.execute(`
      ALTER TABLE tournaments
      MODIFY COLUMN type ENUM(${withoutLegacy.map((v) => `'${v}'`).join(", ")}) NOT NULL
    `);
  }

  console.log("  ✅ ENUM обновлён");
  console.log("  ✅ Миграция успешно выполнена");
}

export async function down(pool: Pool): Promise<void> {
  console.log("  📝 Откат миграции: объединение типов тет-а-тет...");

  // Сначала меняем все новые типы обратно на TET-A-TET
  await pool.execute(`
    UPDATE tournaments 
    SET type = 'TET-A-TET' 
    WHERE type IN ('TET_A_TET_MALE', 'TET_A_TET_FEMALE')
  `);

  console.log("  ✅ Существующие турниры обновлены на TET-A-TET");

  // Возвращаем ENUM к старому виду
  await pool.execute(`
    ALTER TABLE tournaments 
    MODIFY COLUMN type ENUM(
      'TRIPLETTE', 
      'DOUBLETTE_MALE', 
      'DOUBLETTE_FEMALE', 
      'DOUBLETTE_MIXT', 
      'TET-A-TET'
    ) NOT NULL
  `);

  console.log("  ✅ ENUM возвращён к исходному виду");
}
