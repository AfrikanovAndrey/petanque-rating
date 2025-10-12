import { Pool } from "mysql2/promise";

/**
 * Миграция: Разделение типа TET-A-TET на мужской и женский
 *
 * Изменяет ENUM значения для колонки type в таблице tournaments:
 * - Заменяет TET-A-TET на TET_A_TET_MALE и TET_A_TET_FEMALE
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  📝 Изменение типов турниров: разделение TET-A-TET...");

  // Изменяем ENUM, добавляя новые значения
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
