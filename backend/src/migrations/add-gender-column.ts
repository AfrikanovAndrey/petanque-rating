import { pool } from "../config/database";

/**
 * Миграция для добавления поля gender в таблицу players
 * Возможные значения: 'male', 'female', null (неопределено)
 */
export async function addGenderColumn(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🚻 Добавление поля gender в таблицу players...");

    // 1. Проверяем, существует ли уже колонка gender
    const [columnCheck] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'players'
      AND COLUMN_NAME = 'gender'
    `);

    const hasGenderColumn = (columnCheck as any[])[0].count > 0;

    if (hasGenderColumn) {
      console.log("✅ Поле gender уже существует в таблице players");
      await connection.commit();
      return;
    }

    // 2. Добавляем поле gender
    console.log("📝 Добавляем поле gender...");
    await connection.execute(`
      ALTER TABLE players 
      ADD COLUMN gender ENUM('male', 'female') DEFAULT NULL
      AFTER name
    `);

    // 3. Добавляем индекс для поиска по полу
    console.log("📊 Добавляем индекс для gender...");
    await connection.execute(`
      ALTER TABLE players 
      ADD INDEX idx_gender (gender)
    `);

    await connection.commit();
    console.log("✅ Миграция добавления поля gender завершена успешно!");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}
