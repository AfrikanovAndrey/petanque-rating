import { Pool } from "mysql2/promise";

/**
 * Миграция: Удаление поля is_active из таблицы licensed_players
 * Действующая лицензия определяется по году приобретения, а не по флагу is_active
 */

export async function up(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка is_active
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'is_active'
    `);

    // Если колонка не существует, пропускаем миграцию
    if ((columns as any[]).length === 0) {
      console.log(
        "✓ Миграция 011: колонка is_active уже удалена из таблицы licensed_players"
      );
      return;
    }

    // Удаляем индекс idx_year_active если он существует
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND INDEX_NAME = 'idx_year_active'
    `);

    if ((indexes as any[]).length > 0) {
      await pool.execute(`
        ALTER TABLE licensed_players 
        DROP INDEX idx_year_active
      `);
      console.log(
        "✓ Миграция 011: удален индекс idx_year_active из таблицы licensed_players"
      );
    }

    // Удаляем колонку is_active
    await pool.execute(`
      ALTER TABLE licensed_players 
      DROP COLUMN is_active
    `);

    console.log(
      "✓ Миграция 011: удалена колонка is_active из таблицы licensed_players"
    );

    // Создаем индекс только по year
    await pool.execute(`
      ALTER TABLE licensed_players 
      ADD INDEX idx_year (year)
    `);

    console.log(
      "✓ Миграция 011: добавлен индекс idx_year в таблицу licensed_players"
    );
  } catch (error) {
    console.error("✗ Ошибка миграции 011:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка is_active
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'is_active'
    `);

    // Если колонка уже существует, пропускаем откат
    if ((columns as any[]).length > 0) {
      console.log(
        "✓ Откат миграции 011: колонка is_active уже существует в таблице licensed_players"
      );
      return;
    }

    // Удаляем индекс idx_year если он существует
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND INDEX_NAME = 'idx_year'
    `);

    if ((indexes as any[]).length > 0) {
      await pool.execute(`
        ALTER TABLE licensed_players 
        DROP INDEX idx_year
      `);
      console.log(
        "✓ Откат миграции 011: удален индекс idx_year из таблицы licensed_players"
      );
    }

    // Добавляем колонку is_active обратно
    await pool.execute(`
      ALTER TABLE licensed_players 
      ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER year
    `);

    console.log(
      "✓ Откат миграции 011: добавлена колонка is_active в таблицу licensed_players"
    );

    // Создаем композитный индекс idx_year_active
    await pool.execute(`
      ALTER TABLE licensed_players 
      ADD INDEX idx_year_active (year, is_active)
    `);

    console.log(
      "✓ Откат миграции 011: добавлен индекс idx_year_active в таблицу licensed_players"
    );

    // Устанавливаем is_active = TRUE для всех существующих записей
    await pool.execute(`
      UPDATE licensed_players 
      SET is_active = TRUE 
      WHERE is_active IS NULL
    `);

    console.log(
      "✓ Откат миграции 011: установлено is_active = TRUE для всех записей"
    );
  } catch (error) {
    console.error("✗ Ошибка отката миграции 011:", error);
    throw error;
  }
}

