import { Pool } from "mysql2/promise";

/**
 * Миграция: Удаление поля city из licensed_players
 * Город игрока теперь хранится только в таблице players
 */

export async function up(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Начало миграции 013: удаление city из licensed_players");

    // Проверяем, существует ли колонка city в licensed_players
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'city'
    `);

    if ((columns as any[]).length > 0) {
      // Удаляем колонку city
      await pool.execute(`
        ALTER TABLE licensed_players 
        DROP COLUMN city
      `);

      console.log("✓ Удалена колонка city из таблицы licensed_players");
    } else {
      console.log("✓ Колонка city уже удалена из таблицы licensed_players");
    }

    console.log("✅ Миграция 013 успешно завершена");
  } catch (error) {
    console.error("✗ Ошибка миграции 013:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Откат миграции 013: восстановление city в licensed_players");

    // Проверяем, существует ли колонка city
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'city'
    `);

    if ((columns as any[]).length === 0) {
      // Добавляем колонку city обратно
      await pool.execute(`
        ALTER TABLE licensed_players 
        ADD COLUMN city VARCHAR(100) NOT NULL DEFAULT '' AFTER player_id
      `);

      console.log("✓ Добавлена колонка city в таблицу licensed_players");

      // Копируем данные из players
      await pool.execute(`
        UPDATE licensed_players lp
        INNER JOIN players p ON lp.player_id = p.id
        SET lp.city = COALESCE(p.city, 'Не указан')
        WHERE p.city IS NOT NULL
      `);

      console.log("✓ Данные о городах восстановлены из таблицы players");
    } else {
      console.log("✓ Колонка city уже существует в licensed_players");
    }

    console.log("✅ Откат миграции 013 успешно завершен");
  } catch (error) {
    console.error("✗ Ошибка отката миграции 013:", error);
    throw error;
  }
}

