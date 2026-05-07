import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: поле regulations (регламент турнира) в tournaments
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  🔍 Проверка наличия поля regulations в tournaments...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'regulations'
  `);

  if (columns.length > 0) {
    console.log("  ✅ Поле regulations уже существует");
    return;
  }

  console.log("  📝 Добавление поля regulations в таблицу tournaments...");

  await pool.execute(`
    ALTER TABLE tournaments 
    ADD COLUMN regulations TEXT NULL 
    COMMENT 'Описание турнира (текст)' 
    AFTER status
  `);

  console.log("  ✅ Поле regulations успешно добавлено");
}

export async function down(pool: Pool): Promise<void> {
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'regulations'
  `);

  if (columns.length === 0) {
    console.log("  ✅ Поле regulations уже удалено");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments 
    DROP COLUMN regulations
  `);

  console.log("  ✅ Поле regulations успешно удалено");
}
