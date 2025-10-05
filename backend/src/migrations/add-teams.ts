import { pool } from "../config/database";

const teamsMigrations = [
  // 1. Создание таблицы команд
  `CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tournament_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    INDEX idx_tournament (tournament_id),
    INDEX idx_name (name)
  )`,

  // 2. Создание таблицы участников команд (1-4 игрока)
  `CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    player_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_player (team_id, player_id),
    INDEX idx_team (team_id),
    INDEX idx_player (player_id),
    INDEX idx_sort_order (team_id, sort_order)
  )`,

  // 3. Создание новой таблицы tournament_results с team_id вместо player_id
  `CREATE TABLE IF NOT EXISTS tournament_results_new (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    team_id INT NOT NULL,
    cup_position ENUM('CUP_WINNER', 'CUP_RUNNER_UP', 'CUP_THIRD_PLACE', 'CUP_SEMI_FINAL', 'CUP_QUARTER_FINAL', 'QUALIFYING_HIGH', 'QUALIFYING_LOW') NOT NULL DEFAULT 'CUP_QUARTER_FINAL',
    points INT NOT NULL DEFAULT 0,
    cup ENUM('A', 'B') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_tournament_team (tournament_id, team_id),
    INDEX idx_tournament_cup (tournament_id, cup),
    INDEX idx_points (points DESC),
    INDEX idx_cup_position (cup_position)
  )`,
];

const dataMigration = `
  -- Миграция данных из старой таблицы в новую структуру
  -- Для каждого результата создаем команду из одного игрока
  INSERT INTO teams (name, tournament_id, created_at, updated_at)
  SELECT 
    p.name as name,
    tr.tournament_id,
    tr.created_at,
    tr.updated_at
  FROM tournament_results tr
  JOIN players p ON tr.player_id = p.id;
  
  -- Добавляем игроков в команды
  INSERT INTO team_members (team_id, player_id, sort_order, created_at, updated_at)
  SELECT 
    t.id as team_id,
    tr.player_id,
    1 as sort_order,
    tr.created_at,
    tr.updated_at
  FROM tournament_results tr
  JOIN players p ON tr.player_id = p.id
  JOIN teams t ON t.name = p.name AND t.tournament_id = tr.tournament_id;
  
  -- Копируем результаты в новую таблицу
  INSERT INTO tournament_results_new (tournament_id, team_id, cup_position, points, cup, created_at, updated_at)
  SELECT
    tr.tournament_id,
    t.id as team_id,
    tr.cup_position,
    tr.points,
    tr.cup,
    tr.created_at,
    tr.updated_at
  FROM tournament_results tr
  JOIN players p ON tr.player_id = p.id
  JOIN teams t ON t.name = p.name AND t.tournament_id = tr.tournament_id;
`;

const finalMigrations = [
  // 4. Удаляем старую таблицу и переименовываем новую
  `DROP TABLE tournament_results`,
  `ALTER TABLE tournament_results_new RENAME TO tournament_results`,
];

export const runTeamsMigrations = async () => {
  const connection = await pool.getConnection();
  try {
    console.log("🚀 Запуск миграций команд...");

    await connection.beginTransaction();

    // Выполняем создание таблиц
    for (let i = 0; i < teamsMigrations.length; i++) {
      console.log(`Создание таблиц ${i + 1}/${teamsMigrations.length}...`);
      await connection.execute(teamsMigrations[i]);
    }

    // Миграция данных
    console.log("📊 Миграция данных...");
    const statements = dataMigration.split(";").filter((stmt) => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement.trim());
      }
    }

    // Финальные миграции
    for (let i = 0; i < finalMigrations.length; i++) {
      console.log(`Финальные изменения ${i + 1}/${finalMigrations.length}...`);
      await connection.execute(finalMigrations[i]);
    }

    await connection.commit();
    console.log("✅ Миграции команд выполнены успешно");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка при выполнении миграций команд:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Запуск миграций если скрипт вызван напрямую
if (require.main === module) {
  runTeamsMigrations()
    .then(() => {
      console.log("Миграции команд завершены");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка миграций команд:", error);
      process.exit(1);
    });
}
