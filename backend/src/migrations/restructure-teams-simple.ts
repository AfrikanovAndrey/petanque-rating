import { pool } from "../config/database";

const simpleMigration = [
  // 1. Отключаем проверки внешних ключей
  `SET FOREIGN_KEY_CHECKS = 0`,

  // 2. Удаляем старые таблицы если они есть
  `DROP TABLE IF EXISTS team_members`,
  `DROP TABLE IF EXISTS teams`,

  // 3. Создаем новую таблицу teams
  `CREATE TABLE teams (
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

  // 4. Включаем проверки внешних ключей обратно
  `SET FOREIGN_KEY_CHECKS = 1`,
];

export const runSimpleTeamsMigration = async () => {
  const connection = await pool.getConnection();
  try {
    console.log("🚀 Запуск упрощенной миграции для таблицы teams...");

    await connection.beginTransaction();

    // Выполняем все команды миграции
    for (let i = 0; i < simpleMigration.length; i++) {
      console.log(`Выполнение команды ${i + 1}/${simpleMigration.length}...`);
      await connection.execute(simpleMigration[i]);
    }

    await connection.commit();
    console.log("✅ Упрощенная миграция teams выполнена успешно");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка при выполнении упрощенной миграции teams:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Запуск миграций если скрипт вызван напрямую
if (require.main === module) {
  runSimpleTeamsMigration()
    .then(() => {
      console.log("Миграции завершены");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка при выполнении миграций:", error);
      process.exit(1);
    });
}
