import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: Добавление поля manual в таблицу tournaments
 *
 * Добавляет колонку manual типа BOOLEAN со значением по умолчанию FALSE
 * true - при обработке результатов турнира с листа "Ручной ввод"
 * Дата: 2025-10-16
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  🔍 Проверка наличия поля manual в tournaments...");

  // Проверяем, существует ли уже колонка manual
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'manual'
  `);

  if (columns.length > 0) {
    console.log("  ✅ Поле manual уже существует");
    return;
  }

  console.log("  📝 Добавление поля manual в таблицу tournaments...");

  // Добавляем колонку manual после date
  await pool.execute(`
    ALTER TABLE tournaments 
    ADD COLUMN manual BOOLEAN NOT NULL DEFAULT FALSE 
    COMMENT 'TRUE при обработке результатов турнира с листа "Ручной ввод"'
    AFTER date
  `);

  console.log("  ✅ Поле manual успешно добавлено");
}

export async function down(pool: Pool): Promise<void> {
  console.log("  📝 Удаление поля manual из таблицы tournaments...");

  // Проверяем, существует ли колонка manual
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'manual'
  `);

  if (columns.length === 0) {
    console.log("  ✅ Поле manual уже удалено");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments 
    DROP COLUMN manual
  `);

  console.log("  ✅ Поле manual успешно удалено");
}
