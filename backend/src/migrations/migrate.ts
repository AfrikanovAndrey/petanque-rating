import { pool } from "../config/database";

const migrations = [
  // 1. Создание таблицы игроков
  `CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
  )`,

  // 2. Создание таблицы турниров
  `CREATE TABLE IF NOT EXISTS tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date)
  )`,

  // 3. Создание таблицы результатов турниров
  `CREATE TABLE IF NOT EXISTS tournament_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    player_id INT NOT NULL,
    position INT NOT NULL,
    points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tournament_player (tournament_id, player_id),
    INDEX idx_tournament_player (tournament_id, player_id),
    INDEX idx_points (points DESC)
  )`,

  // 4. Создание таблицы настроек рейтинга
  `CREATE TABLE IF NOT EXISTS rating_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_name VARCHAR(50) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // 5. Создание таблицы очков за позицию
  `CREATE TABLE IF NOT EXISTS position_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position INT NOT NULL UNIQUE,
    points INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_position (position)
  )`,

  // 6. Создание таблицы администраторов
  `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

const seedData = [
  // Настройки по умолчанию
  `INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
    ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
    ('current_season', '2025', 'Текущий сезон')`,

  // Очки за позиции по умолчанию (первые 20 позиций)
  `INSERT IGNORE INTO position_points (position, points) VALUES 
    (1, 100), (2, 90), (3, 80), (4, 75), (5, 70),
    (6, 65), (7, 60), (8, 55), (9, 50), (10, 45),
    (11, 40), (12, 38), (13, 36), (14, 34), (15, 32),
    (16, 30), (17, 28), (18, 26), (19, 24), (20, 22)`,
];

export const runMigrations = async () => {
  try {
    console.log("🚀 Запуск миграций...");

    for (let i = 0; i < migrations.length; i++) {
      console.log(`Выполнение миграции ${i + 1}/${migrations.length}...`);
      await pool.execute(migrations[i]);
    }

    console.log("🌱 Добавление начальных данных...");
    for (const seed of seedData) {
      await pool.execute(seed);
    }

    console.log("✅ Миграции выполнены успешно");
  } catch (error) {
    console.error("❌ Ошибка при выполнении миграций:", error);
    throw error;
  }
};

// Запуск миграций если скрипт вызван напрямую
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Миграции завершены");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка миграций:", error);
      process.exit(1);
    });
}
