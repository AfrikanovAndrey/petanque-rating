import { Pool } from "mysql2/promise";

/**
 * Миграция 014: Добавление уникального индекса на (player_id, year) в licensed_players
 * 
 * Цель: Предотвратить создание дублирующих лицензий для одного игрока в одном году
 * на уровне базы данных (не только в коде)
 */

export async function up(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Начало миграции 014: добавление UNIQUE индекса (player_id, year)");

    // Проверяем, существует ли уже индекс
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'licensed_players'
        AND INDEX_NAME = 'unique_player_year'
    `);

    if ((indexes as any[]).length > 0) {
      console.log("✓ Индекс unique_player_year уже существует");
    } else {
      // Перед добавлением уникального индекса нужно удалить дубликаты, если они есть
      console.log("🔍 Проверка и удаление дубликатов...");
      
      // Находим дубликаты (оставляем самую раннюю запись по id для каждой пары player_id-year)
      const [duplicates] = await pool.execute(`
        SELECT lp1.id
        FROM licensed_players lp1
        INNER JOIN licensed_players lp2 
          ON lp1.player_id = lp2.player_id 
          AND lp1.year = lp2.year 
          AND lp1.id > lp2.id
      `);

      if ((duplicates as any[]).length > 0) {
        console.log(`⚠️  Найдено ${(duplicates as any[]).length} дублирующих записей`);
        
        // Удаляем дубликаты
        await pool.execute(`
          DELETE lp1 FROM licensed_players lp1
          INNER JOIN licensed_players lp2 
            ON lp1.player_id = lp2.player_id 
            AND lp1.year = lp2.year 
            AND lp1.id > lp2.id
        `);
        
        console.log("✓ Дубликаты удалены");
      } else {
        console.log("✓ Дубликатов не найдено");
      }

      // Добавляем уникальный индекс
      await pool.execute(`
        ALTER TABLE licensed_players 
        ADD UNIQUE KEY unique_player_year (player_id, year)
      `);
      console.log("✓ Добавлен уникальный индекс unique_player_year");
    }

    console.log("✅ Миграция 014 успешно завершена");
  } catch (error) {
    console.error("✗ Ошибка миграции 014:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Откат миграции 014: удаление UNIQUE индекса (player_id, year)");

    // Проверяем, существует ли индекс
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'licensed_players'
        AND INDEX_NAME = 'unique_player_year'
    `);

    if ((indexes as any[]).length > 0) {
      await pool.execute(`
        ALTER TABLE licensed_players 
        DROP INDEX unique_player_year
      `);
      console.log("✓ Удален индекс unique_player_year");
    } else {
      console.log("✓ Индекс unique_player_year не найден, пропуск");
    }

    console.log("✅ Откат миграции 014 завершен");
  } catch (error) {
    console.error("✗ Ошибка отката миграции 014:", error);
    throw error;
  }
}

