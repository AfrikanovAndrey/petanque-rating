import { Pool } from "mysql2/promise";

/**
 * Миграция: Перенос license_number из licensed_players в players
 * Номер лицензии теперь закреплен за игроком навсегда и хранится в таблице players
 */

export async function up(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Начало миграции 012: перенос license_number в players");

    // 1. Проверяем, существует ли колонка license_number в таблице players
    const [playersColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'players' 
        AND COLUMN_NAME = 'license_number'
    `);

    // Если колонка отсутствует, добавляем её
    if ((playersColumns as any[]).length === 0) {
      await pool.execute(`
        ALTER TABLE players 
        ADD COLUMN license_number VARCHAR(20) NULL UNIQUE AFTER name,
        ADD INDEX idx_license_number (license_number)
      `);
      console.log("✓ Добавлена колонка license_number в таблицу players");
    } else {
      console.log("✓ Колонка license_number уже существует в таблице players");
    }

    // 2. Проверяем, существует ли колонка license_number в licensed_players
    const [licensedPlayersColumnsCheck] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'license_number'
    `);

    // Переносим данные только если колонка существует в licensed_players
    if ((licensedPlayersColumnsCheck as any[]).length > 0) {
      console.log("🔄 Перенос номеров лицензий из licensed_players в players...");

      await pool.execute(`
        UPDATE players p
        INNER JOIN (
          SELECT 
            lp.player_id,
            lp.license_number,
            lp.year
          FROM licensed_players lp
          INNER JOIN (
            SELECT player_id, MAX(year) as max_year
            FROM licensed_players
            GROUP BY player_id
          ) latest ON lp.player_id = latest.player_id AND lp.year = latest.max_year
        ) latest_license ON p.id = latest_license.player_id
        SET p.license_number = latest_license.license_number
        WHERE p.license_number IS NULL
      `);

      console.log("✓ Номера лицензий перенесены в таблицу players");
    } else {
      console.log("✓ Колонка license_number отсутствует в licensed_players, пропускаем перенос данных");
    }

    // 3. Проверяем, существует ли колонка license_number в licensed_players
    const [licensedPlayersColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'license_number'
    `);

    // Если колонка существует, удаляем её
    if ((licensedPlayersColumns as any[]).length > 0) {
      // Сначала удаляем индекс
      const [indexes] = await pool.execute(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'licensed_players' 
          AND INDEX_NAME = 'idx_license_number'
      `);

      if ((indexes as any[]).length > 0) {
        await pool.execute(`
          ALTER TABLE licensed_players 
          DROP INDEX idx_license_number
        `);
        console.log(
          "✓ Удален индекс idx_license_number из таблицы licensed_players"
        );
      }

      // Удаляем unique constraint на license_number если есть
      const [uniqueConstraints] = await pool.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'licensed_players' 
          AND CONSTRAINT_TYPE = 'UNIQUE'
          AND CONSTRAINT_NAME = 'license_number'
      `);

      if ((uniqueConstraints as any[]).length > 0) {
        await pool.execute(`
          ALTER TABLE licensed_players 
          DROP INDEX license_number
        `);
        console.log(
          "✓ Удален unique constraint на license_number из таблицы licensed_players"
        );
      }

      // Удаляем колонку license_number
      await pool.execute(`
        ALTER TABLE licensed_players 
        DROP COLUMN license_number
      `);

      console.log(
        "✓ Удалена колонка license_number из таблицы licensed_players"
      );
    } else {
      console.log(
        "✓ Колонка license_number уже удалена из таблицы licensed_players"
      );
    }

    console.log("✅ Миграция 012 успешно завершена");
  } catch (error) {
    console.error("✗ Ошибка миграции 012:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    console.log("🔄 Откат миграции 012: возврат license_number в licensed_players");

    // 1. Проверяем, существует ли колонка license_number в licensed_players
    const [licensedPlayersColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'licensed_players' 
        AND COLUMN_NAME = 'license_number'
    `);

    // Если колонка отсутствует, добавляем её обратно
    if ((licensedPlayersColumns as any[]).length === 0) {
      await pool.execute(`
        ALTER TABLE licensed_players 
        ADD COLUMN license_number VARCHAR(20) NOT NULL UNIQUE AFTER player_id,
        ADD INDEX idx_license_number (license_number)
      `);
      console.log(
        "✓ Добавлена колонка license_number в таблицу licensed_players"
      );

      // 2. Копируем данные обратно из players в licensed_players
      // Генерируем уникальные номера для старых записей (добавляем год к номеру)
      console.log(
        "🔄 Восстановление номеров лицензий в licensed_players..."
      );

      await pool.execute(`
        UPDATE licensed_players lp
        INNER JOIN players p ON lp.player_id = p.id
        SET lp.license_number = CONCAT(p.license_number, '-', lp.year)
        WHERE p.license_number IS NOT NULL
      `);

      console.log("✓ Номера лицензий восстановлены в licensed_players");
    } else {
      console.log(
        "✓ Колонка license_number уже существует в licensed_players"
      );
    }

    // 3. Удаляем колонку license_number из players
    const [playersColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'players' 
        AND COLUMN_NAME = 'license_number'
    `);

    if ((playersColumns as any[]).length > 0) {
      // Удаляем индекс
      const [indexes] = await pool.execute(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'players' 
          AND INDEX_NAME = 'idx_license_number'
      `);

      if ((indexes as any[]).length > 0) {
        await pool.execute(`
          ALTER TABLE players 
          DROP INDEX idx_license_number
        `);
        console.log("✓ Удален индекс idx_license_number из таблицы players");
      }

      // Удаляем колонку
      await pool.execute(`
        ALTER TABLE players 
        DROP COLUMN license_number
      `);

      console.log("✓ Удалена колонка license_number из таблицы players");
    }

    console.log("✅ Откат миграции 012 успешно завершен");
  } catch (error) {
    console.error("✗ Ошибка отката миграции 012:", error);
    throw error;
  }
}

