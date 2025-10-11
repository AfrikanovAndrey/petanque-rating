import { Pool } from "mysql2/promise";

/**
 * Миграция: Добавление значения 'C' в ENUM поле cup таблицы tournament_results
 */

export async function up(pool: Pool): Promise<void> {
  try {
    // Проверяем текущие значения ENUM для поля cup
    const [columns] = await pool.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tournament_results' 
        AND COLUMN_NAME = 'cup'
    `);

    const columnType = (columns as any[])[0]?.COLUMN_TYPE;

    // Если 'C' уже есть в ENUM, пропускаем миграцию
    if (columnType && columnType.includes("'C'")) {
      console.log("✓ Миграция 003: значение 'C' уже существует в поле cup");
      return;
    }

    // Добавляем значение 'C' в ENUM
    await pool.execute(`
      ALTER TABLE tournament_results 
      MODIFY COLUMN cup ENUM('A', 'B', 'C') NULL
    `);

    console.log("✓ Миграция 003: добавлено значение 'C' в поле cup");
  } catch (error) {
    console.error("✗ Ошибка миграции 003:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    // Проверяем, есть ли записи с cup = 'C'
    const [rows] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM tournament_results 
      WHERE cup = 'C'
    `);

    const count = (rows as any[])[0]?.count || 0;

    if (count > 0) {
      console.warn(
        `⚠️  Откат миграции 003 невозможен: существует ${count} записей с cup = 'C'`
      );
      throw new Error("Невозможно откатить миграцию: есть данные с cup = 'C'");
    }

    // Удаляем значение 'C' из ENUM
    await pool.execute(`
      ALTER TABLE tournament_results 
      MODIFY COLUMN cup ENUM('A', 'B') NULL
    `);

    console.log("✓ Откат миграции 003: удалено значение 'C' из поля cup");
  } catch (error) {
    console.error("✗ Ошибка отката миграции 003:", error);
    throw error;
  }
}
