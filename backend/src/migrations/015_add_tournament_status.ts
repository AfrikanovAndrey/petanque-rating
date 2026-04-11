import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: статус турнира (FINISHED, REGISTRATION, IN_PROGRESS)
 * По умолчанию FINISHED для существующих и новых записей.
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  🔍 Проверка наличия поля status в tournaments...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'status'
  `);

  if (columns.length > 0) {
    console.log("  ✅ Поле status уже существует");
    return;
  }

  console.log("  📝 Добавление поля status в таблицу tournaments...");

  await pool.execute(`
    ALTER TABLE tournaments 
    ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'FINISHED' 
    COMMENT 'FINISHED | REGISTRATION | IN_PROGRESS'
    AFTER manual
  `);

  console.log("  ✅ Поле status успешно добавлено");
}

export async function down(pool: Pool): Promise<void> {
  console.log("  📝 Удаление поля status из таблицы tournaments...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'status'
  `);

  if (columns.length === 0) {
    console.log("  ✅ Поле status уже удалено");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments 
    DROP COLUMN status
  `);

  console.log("  ✅ Поле status успешно удалено");
}
