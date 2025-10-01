import { pool } from "../config/database";

const migration = [
  // 1. Отключаем проверки внешних ключей
  `SET FOREIGN_KEY_CHECKS = 0`,

  // 2. Создаем новую таблицу teams без tournament_id
  `CREATE TABLE teams_global (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player1_id INT NOT NULL,
    player2_id INT NULL,
    player3_id INT NULL, 
    player4_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player3_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player4_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_player1 (player1_id),
    INDEX idx_player2 (player2_id),
    INDEX idx_player3 (player3_id),
    INDEX idx_player4 (player4_id),
    UNIQUE KEY unique_team_composition (player1_id, player2_id, player3_id, player4_id)
  )`,

  // 3. Удаляем старую таблицу teams и переименовываем новую
  `DROP TABLE IF EXISTS teams`,
  `ALTER TABLE teams_global RENAME TO teams`,

  // 4. Включаем проверки внешних ключей обратно
  `SET FOREIGN_KEY_CHECKS = 1`,
];

export const runRemoveTournamentFromTeams = async () => {
  const connection = await pool.getConnection();
  try {
    console.log("🚀 Удаление tournament_id из таблицы teams...");

    await connection.beginTransaction();

    // Выполняем все команды миграции
    for (let i = 0; i < migration.length; i++) {
      console.log(`Выполнение команды ${i + 1}/${migration.length}...`);
      await connection.execute(migration[i]);
    }

    await connection.commit();
    console.log(
      "✅ Миграция завершена: teams теперь глобальная таблица команд"
    );
    console.log(
      "ℹ️  Команды теперь уникальны только по составу игроков, без привязки к турнирам"
    );
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка при миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Запуск миграций если скрипт вызван напрямую
if (require.main === module) {
  runRemoveTournamentFromTeams()
    .then(() => {
      console.log("Миграция завершена");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка при выполнении миграции:", error);
      process.exit(1);
    });
}
