import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * Миграция для связывания таблиц licensed_players и players
 * Убирает поле full_name из licensed_players и создает связь через player_id
 */
export async function linkLicensedPlayersWithPlayers(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log(
      "🔗 Начинаем миграцию связывания licensed_players с players..."
    );

    // 1. Проверяем, существует ли уже поле player_id
    const [columnCheck] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'licensed_players'
      AND COLUMN_NAME = 'player_id'
    `);

    const hasPlayerIdColumn = (columnCheck as any[])[0].count > 0;

    if (hasPlayerIdColumn) {
      console.log("✅ Миграция уже выполнена - поле player_id существует");
      await connection.commit();
      return;
    }

    // 2. Проверяем, есть ли поле full_name для миграции
    const [fullNameCheck] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'licensed_players'
      AND COLUMN_NAME = 'full_name'
    `);

    const hasFullNameColumn = (fullNameCheck as any[])[0].count > 0;

    if (!hasFullNameColumn) {
      console.log("❌ Поле full_name не найдено в licensed_players");
      throw new Error(
        "Невозможно выполнить миграцию - отсутствует поле full_name"
      );
    }

    // 3. Получаем все записи из licensed_players
    const [licensedPlayers] = await connection.execute<RowDataPacket[]>(`
      SELECT id, full_name, license_number, city, license_date, year, is_active
      FROM licensed_players
    `);

    console.log(
      `📊 Найдено ${licensedPlayers.length} лицензионных игроков для миграции`
    );

    // 4. Добавляем поле player_id в licensed_players
    console.log("📝 Добавляем поле player_id...");
    await connection.execute(`
      ALTER TABLE licensed_players 
      ADD COLUMN player_id INT NULL
      AFTER id
    `);

    let createdPlayers = 0;
    let linkedPlayers = 0;

    // 5. Для каждого лицензионного игрока создаем или находим игрока в таблице players
    for (const licensedPlayer of licensedPlayers) {
      let playerId: number;

      // Проверяем, существует ли уже игрок с таким именем
      const [existingPlayer] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM players WHERE name = ?",
        [licensedPlayer.full_name]
      );

      if (existingPlayer.length > 0) {
        // Игрок уже существует
        playerId = existingPlayer[0].id;
        console.log(
          `👤 Игрок "${licensedPlayer.full_name}" уже существует (ID: ${playerId})`
        );
      } else {
        // Создаем нового игрока
        const [insertResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO players (name) VALUES (?)",
          [licensedPlayer.full_name]
        );
        playerId = insertResult.insertId;
        createdPlayers++;
        console.log(
          `➕ Создан игрок "${licensedPlayer.full_name}" (ID: ${playerId})`
        );
      }

      // Связываем лицензионного игрока с игроком
      await connection.execute(
        "UPDATE licensed_players SET player_id = ? WHERE id = ?",
        [playerId, licensedPlayer.id]
      );
      linkedPlayers++;
    }

    // 6. Делаем поле player_id обязательным
    console.log("🔧 Делаем поле player_id обязательным...");
    await connection.execute(`
      ALTER TABLE licensed_players 
      MODIFY COLUMN player_id INT NOT NULL
    `);

    // 7. Добавляем внешний ключ и индексы
    console.log("🔗 Добавляем внешний ключ и индексы...");
    await connection.execute(`
      ALTER TABLE licensed_players 
      ADD CONSTRAINT fk_licensed_players_player_id 
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE licensed_players 
      ADD INDEX idx_player_id (player_id)
    `);

    // 8. Добавляем уникальный индекс для предотвращения дублирования игрока в одном году
    await connection.execute(`
      ALTER TABLE licensed_players 
      ADD UNIQUE KEY unique_player_year (player_id, year)
    `);

    // 9. Удаляем старое поле full_name и его индекс
    console.log("🗑️ Удаляем поле full_name...");

    // Сначала удаляем индекс если существует
    try {
      await connection.execute(`
        ALTER TABLE licensed_players 
        DROP INDEX idx_full_name
      `);
    } catch (error) {
      // Игнорируем ошибку если индекс не существует
      console.log("ℹ️ Индекс idx_full_name не найден или уже удален");
    }

    // Затем удаляем поле
    await connection.execute(`
      ALTER TABLE licensed_players 
      DROP COLUMN full_name
    `);

    await connection.commit();

    console.log("✅ Миграция связывания licensed_players с players завершена:");
    console.log(`   👥 Игроков создано: ${createdPlayers}`);
    console.log(`   🔗 Связей установлено: ${linkedPlayers}`);
    console.log(`   🗑️ Поле full_name удалено`);
    console.log(`   ✨ Добавлены внешние ключи и индексы`);

    // 10. Показываем статистику
    const [stats] = await connection.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(DISTINCT lp.player_id) as unique_players,
        COUNT(*) as total_licenses,
        MIN(lp.year) as earliest_year,
        MAX(lp.year) as latest_year
      FROM licensed_players lp
    `);

    const statistics = stats[0];
    console.log(`📊 Статистика после миграции:`);
    console.log(`   👥 Уникальных игроков: ${statistics.unique_players}`);
    console.log(`   📄 Всего лицензий: ${statistics.total_licenses}`);
    console.log(
      `   📅 Годы лицензий: ${statistics.earliest_year} - ${statistics.latest_year}`
    );
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Экспорт для использования в migrate.ts
export { linkLicensedPlayersWithPlayers as migrate };
