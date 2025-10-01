import { pool } from "../config/database";
import { checkAndFixCupPositionColumn } from "./fix-cup-position";
import { runTeamsMigrations } from "./add-teams";
import { runAddWinsColumnMigration } from "./add-wins-column";
import { renameCupPositionToPointsReason } from "./rename-cup-position-to-points-reason";
import { removePositionEnumDuplicates } from "./remove-position-enum-duplicates";
import { renameWinsToQualifyingWins } from "./rename-wins-to-qualifying-wins";
import { addWinsLosesColumns } from "./add-wins-loses-columns";
import { createPlayerTournamentPoints } from "./create-player-tournament-points";
import { removePointsFromTournamentResults } from "./remove-points-from-tournament-results";
import { addGenderColumn } from "./add-gender-column";
import { populateGender } from "./populate-gender";
import { updateGender } from "./update-gender";

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
    cup_position VARCHAR(10) NOT NULL,
    points INT NOT NULL DEFAULT 0,
    cup ENUM('A', 'B') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_tournament_player (tournament_id, player_id),
    INDEX idx_tournament_cup (tournament_id, cup),
    INDEX idx_points (points DESC),
    INDEX idx_cup_position (cup_position)
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

  // 6. Создание таблицы администраторов
  `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // 7. Создание таблицы лицензионных игроков
  `CREATE TABLE IF NOT EXISTS licensed_players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_number VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    license_date DATE NOT NULL,
    year INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_license_number (license_number),
    INDEX idx_year_active (year, is_active),
    INDEX idx_full_name (full_name)
  )`,
];

const seedData = [
  // Настройки по умолчанию
  `INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
    ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
    ('current_season', '2025', 'Текущий сезон')`,
];

export const runMigrations = async () => {
  try {
    console.log("🚀 Запуск миграций...");

    for (let i = 0; i < migrations.length; i++) {
      console.log(`Выполнение миграции ${i + 1}/${migrations.length}...`);
      await pool.execute(migrations[i]);
    }

    // console.log("🔧 Проверка и исправление структуры таблиц...");
    // await checkAndFixCupPositionColumn(); // Отключено - заменено на points_reason миграцию

    console.log("🔧 Добавление поля wins в таблицу tournament_results...");
    await runAddWinsColumnMigration();

    console.log("🔧 Переименование cup_position в points_reason...");
    await renameCupPositionToPointsReason();

    console.log("🔧 Удаление дублирующихся POSITION_* значений в enum...");
    await removePositionEnumDuplicates();

    console.log("🔧 Переименование wins в qualifying_wins...");
    await renameWinsToQualifyingWins();

    console.log("🔧 Добавление столбцов wins и loses...");
    await addWinsLosesColumns();

    console.log("🔧 Создание таблицы player_tournament_points...");
    await createPlayerTournamentPoints();

    console.log("🔧 Удаление колонки points из tournament_results...");
    await removePointsFromTournamentResults();

    console.log("🚻 Добавление поля gender в таблицу players...");
    await addGenderColumn();

    console.log("🚻 Заполнение пола для существующих игроков...");
    await populateGender();

    console.log("🔄 Обновление пола игроков с улучшенным алгоритмом...");
    await updateGender();

    console.log("🌱 Добавление начальных данных...");
    for (const seed of seedData) {
      await pool.execute(seed);
    }

    // Миграции команд уже выполнены
    // console.log("🏆 Выполнение миграций команд...");
    // await runTeamsMigrations();

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
