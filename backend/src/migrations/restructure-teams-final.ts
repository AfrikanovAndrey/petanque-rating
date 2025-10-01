import { pool } from "../config/database";

/**
 * Миграция для перехода к таблице team_players и удаления полей player1_id, player2_id, player3_id, player4_id из teams
 */
export async function restructureTeamsFinal(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🔄 Начинаем миграцию структуры команд...");

    // 1. Создаем таблицу team_players если не существует
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS team_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        player_id INT NOT NULL,
        position TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE KEY unique_team_player (team_id, player_id),
        KEY idx_team_id (team_id),
        KEY idx_player_id (player_id)
      )
    `);
    console.log("✓ Создана таблица team_players");

    // 2. Переносим данные из старой структуры teams в team_players
    const [existingTeams] = await connection.execute(`
      SELECT id, player1_id, player2_id, player3_id, player4_id 
      FROM teams 
      WHERE player1_id IS NOT NULL
    `);

    let migratedTeams = 0;
    let migratedPlayers = 0;

    for (const team of existingTeams as any[]) {
      const playerIds = [
        team.player1_id,
        team.player2_id,
        team.player3_id,
        team.player4_id,
      ].filter((id) => id !== null);

      // Проверяем, есть ли уже записи для этой команды в team_players
      const [existingRecords] = await connection.execute(
        `SELECT COUNT(*) as count FROM team_players WHERE team_id = ?`,
        [team.id]
      );

      if ((existingRecords as any[])[0].count === 0) {
        // Добавляем игроков в team_players
        for (let i = 0; i < playerIds.length; i++) {
          await connection.execute(
            `INSERT INTO team_players (team_id, player_id, position) VALUES (?, ?, ?)`,
            [team.id, playerIds[i], i + 1]
          );
          migratedPlayers++;
        }
        migratedTeams++;
      }
    }

    console.log(
      `✓ Перенесено ${migratedTeams} команд и ${migratedPlayers} связей игрок-команда`
    );

    // 3. Проверяем, что все данные перенесены корректно
    const [oldTeamsCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM teams WHERE player1_id IS NOT NULL
    `);

    const [newTeamsCount] = await connection.execute(`
      SELECT COUNT(DISTINCT team_id) as count FROM team_players
    `);

    const oldCount = (oldTeamsCount as any[])[0].count;
    const newCount = (newTeamsCount as any[])[0].count;

    if (oldCount !== newCount) {
      throw new Error(
        `Ошибка миграции: количество команд не совпадает (старая структура: ${oldCount}, новая: ${newCount})`
      );
    }

    console.log(
      `✓ Проверка данных пройдена: ${newCount} команд перенесено корректно`
    );

    // 4. Удаляем старые внешние ключи и колонки
    try {
      // Удаляем внешние ключи (если существуют)
      const [foreignKeys] = await connection.execute(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teams' 
        AND COLUMN_NAME IN ('player1_id', 'player2_id', 'player3_id', 'player4_id')
        AND REFERENCED_TABLE_NAME = 'players'
      `);

      for (const key of foreignKeys as any[]) {
        await connection.execute(
          `ALTER TABLE teams DROP FOREIGN KEY ${key.CONSTRAINT_NAME}`
        );
        console.log(`✓ Удален внешний ключ: ${key.CONSTRAINT_NAME}`);
      }
    } catch (error) {
      console.log("ℹ️ Внешние ключи не найдены или уже удалены");
    }

    // Удаляем колонки
    const columnsToRemove = [
      "player1_id",
      "player2_id",
      "player3_id",
      "player4_id",
    ];
    for (const column of columnsToRemove) {
      try {
        await connection.execute(`ALTER TABLE teams DROP COLUMN ${column}`);
        console.log(`✓ Удалена колонка: ${column}`);
      } catch (error) {
        console.log(`ℹ️ Колонка ${column} не найдена или уже удалена`);
      }
    }

    // 5. Финальная проверка
    const [finalCheck] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM teams) as teams_count,
        (SELECT COUNT(DISTINCT team_id) FROM team_players) as team_players_count,
        (SELECT COUNT(*) FROM team_players) as total_players_in_teams
    `);

    const stats = (finalCheck as any[])[0];
    console.log(`📊 Статистика после миграции:`);
    console.log(`   - Команд в teams: ${stats.teams_count}`);
    console.log(`   - Команд в team_players: ${stats.team_players_count}`);
    console.log(
      `   - Всего связей игрок-команда: ${stats.total_players_in_teams}`
    );

    await connection.commit();
    console.log("✅ Миграция структуры команд завершена успешно!");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Экспорт для использования в migrate.ts
export { restructureTeamsFinal as migrate };
