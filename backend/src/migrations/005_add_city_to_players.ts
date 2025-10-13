import { Pool } from "mysql2/promise";

/**
 * Миграция: Добавление колонки city в таблицу players
 * Информация о городе игрока переносится из licensed_players в players
 * Это позволяет хранить город на уровне игрока, а не только в лицензиях
 */

export async function up(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка city в таблице players
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'players' 
        AND COLUMN_NAME = 'city'
    `);

    // Если колонка уже существует, пропускаем миграцию
    if ((columns as any[]).length > 0) {
      console.log(
        "✓ Миграция 005: колонка city уже существует в таблице players"
      );
      return;
    }

    // Добавляем колонку city в таблицу players
    await pool.execute(`
      ALTER TABLE players 
      ADD COLUMN city VARCHAR(100) NULL AFTER gender,
      ADD INDEX idx_city (city)
    `);

    console.log("✓ Миграция 005: добавлена колонка city в таблицу players");

    // Копируем данные о городах из licensed_players в players
    // Берем самую последнюю активную лицензию для каждого игрока
    await pool.execute(`
      UPDATE players p
      INNER JOIN (
        SELECT 
          lp.player_id,
          lp.city,
          lp.year
        FROM licensed_players lp
        INNER JOIN (
          SELECT 
            player_id, 
            MAX(year) as max_year
          FROM licensed_players
          WHERE is_active = TRUE
          GROUP BY player_id
        ) latest ON lp.player_id = latest.player_id AND lp.year = latest.max_year
        WHERE lp.is_active = TRUE
      ) latest_license ON p.id = latest_license.player_id
      SET p.city = latest_license.city
    `);

    console.log(
      "✓ Миграция 005: скопированы данные о городах из licensed_players в players"
    );
  } catch (error) {
    console.error("✗ Ошибка миграции 005:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка city
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'players' 
        AND COLUMN_NAME = 'city'
    `);

    // Если колонка не существует, пропускаем откат
    if ((columns as any[]).length === 0) {
      console.log(
        "✓ Откат миграции 005: колонка city уже удалена из таблицы players"
      );
      return;
    }

    // Удаляем колонку city
    await pool.execute(`
      ALTER TABLE players 
      DROP INDEX idx_city,
      DROP COLUMN city
    `);

    console.log(
      "✓ Откат миграции 005: удалена колонка city из таблицы players"
    );
  } catch (error) {
    console.error("✗ Ошибка отката миграции 005:", error);
    throw error;
  }
}
