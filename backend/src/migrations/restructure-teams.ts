import { pool } from "../config/database";

const restructureTeamsMigrations = [
  // 1. Создать новую таблицу teams_new с обновленной структурой
  `CREATE TABLE IF NOT EXISTS teams_new (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    player1_id INT NOT NULL,
    player2_id INT NULL,
    player3_id INT NULL, 
    player4_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player3_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player4_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_tournament (tournament_id),
    INDEX idx_player1 (player1_id),
    INDEX idx_player2 (player2_id),
    INDEX idx_player3 (player3_id),
    INDEX idx_player4 (player4_id),
    INDEX idx_team_players (tournament_id, player1_id, player2_id, player3_id, player4_id)
  )`,
];

// Миграция данных из старой структуры в новую
const dataMigration = `
  -- Миграция существующих команд в новую структуру
  INSERT INTO teams_new (
    id, tournament_id, player1_id, player2_id, player3_id, player4_id, 
    created_at, updated_at
  )
  SELECT 
    t.id,
    t.tournament_id,
    MAX(CASE WHEN tm.sort_order = 1 THEN tm.player_id END) as player1_id,
    MAX(CASE WHEN tm.sort_order = 2 THEN tm.player_id END) as player2_id,
    MAX(CASE WHEN tm.sort_order = 3 THEN tm.player_id END) as player3_id,
    MAX(CASE WHEN tm.sort_order = 4 THEN tm.player_id END) as player4_id,
    t.created_at,
    t.updated_at
  FROM teams t
  LEFT JOIN team_members tm ON t.id = tm.team_id
  GROUP BY t.id, t.tournament_id, t.created_at, t.updated_at;
`;

const finalMigrations = [
  // 2. Удаляем внешние ключи сначала
  `SET FOREIGN_KEY_CHECKS = 0`,
  // Удаляем старые таблицы и переименовываем новую
  `DROP TABLE team_members`,
  `DROP TABLE teams`,
  `ALTER TABLE teams_new RENAME TO teams`,
  // Включаем проверки внешних ключей обратно
  `SET FOREIGN_KEY_CHECKS = 1`,
];

export const runRestructureTeamsMigrations = async () => {
  const connection = await pool.getConnection();
  try {
    console.log("🚀 Запуск миграций для изменения структуры команд...");

    await connection.beginTransaction();

    // Создание новых таблиц
    for (let i = 0; i < restructureTeamsMigrations.length; i++) {
      console.log(
        `Создание таблиц ${i + 1}/${restructureTeamsMigrations.length}...`
      );
      await connection.execute(restructureTeamsMigrations[i]);
    }

    // Миграция данных
    console.log("📊 Миграция данных в новую структуру...");
    const statements = dataMigration.split(";").filter((stmt) => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement.trim());
      }
    }

    // Финальные изменения
    for (let i = 0; i < finalMigrations.length; i++) {
      console.log(`Финальные изменения ${i + 1}/${finalMigrations.length}...`);
      await connection.execute(finalMigrations[i]);
    }

    await connection.commit();
    console.log("✅ Миграции структуры команд выполнены успешно");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка при выполнении миграций структуры команд:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Запуск миграций если скрипт вызван напрямую
if (require.main === module) {
  runRestructureTeamsMigrations()
    .then(() => {
      console.log("Миграции завершены");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка при выполнении миграций:", error);
      process.exit(1);
    });
}
