-- ========================================
-- Инициализация базы данных Petanque Rating System  
-- Создано на основе всех миграций (объединенный файл)
-- ========================================

-- Установка кодировки
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ========================================
-- 1. ОСНОВНЫЕ ТАБЛИЦЫ СИСТЕМЫ
-- ========================================

-- Таблица игроков
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  gender ENUM('male', 'female') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_gender (gender)
);

-- Таблица турниров
CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date)
);

-- Глобальная таблица команд (без привязки к конкретному турниру)
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Связующая таблица команд и игроков
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
);

-- Таблица результатов турниров
CREATE TABLE IF NOT EXISTS tournament_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  team_id INT NOT NULL,
  cup_position ENUM(
    'CUP_WINNER',
    'CUP_RUNNER_UP', 
    'CUP_THIRD_PLACE',
    'CUP_SEMI_FINAL',
    'CUP_QUARTER_FINAL',
    'QUALIFYING_HIGH',
    'QUALIFYING_LOW',
    'QUALIFYING_ONLY'
  ) NOT NULL DEFAULT 'CUP_QUARTER_FINAL',
  cup ENUM('A', 'B') NULL,
  qualifying_wins INT DEFAULT 0,
  wins INT DEFAULT 0,
  loses INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_tournament_team (tournament_id, team_id),
  INDEX idx_tournament_cup (tournament_id, cup),
  INDEX idx_cup_position (cup_position),
  INDEX idx_qualifying_wins (qualifying_wins),
  INDEX idx_wins (wins),
  INDEX idx_loses (loses)
);

-- Таблица рейтинговых очков игроков за турниры
CREATE TABLE IF NOT EXISTS player_tournament_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  player_id INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_player_tournament (player_id, tournament_id),
  INDEX idx_player_points (player_id, points DESC),
  INDEX idx_tournament (tournament_id),
  INDEX idx_points (points DESC)
);

-- ========================================
-- 2. АДМИНИСТРАТИВНЫЕ ТАБЛИЦЫ
-- ========================================

-- Таблица настроек рейтинга
CREATE TABLE IF NOT EXISTS rating_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_name VARCHAR(50) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Таблица лицензионных игроков
CREATE TABLE IF NOT EXISTS licensed_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  license_number VARCHAR(20) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  license_date DATE NOT NULL,
  year INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_player_id (player_id),
  INDEX idx_license_number (license_number),
  INDEX idx_year_active (year, is_active),
  UNIQUE KEY unique_player_year (player_id, year)
);

-- ========================================
-- 3. НАЧАЛЬНЫЕ ДАННЫЕ
-- ========================================

-- Настройки по умолчанию
INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
  ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
  ('current_season', '2025', 'Текущий сезон');

-- ========================================
-- 4. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
-- ========================================

-- Данный файл объединяет функциональность следующих миграций:
-- - migrate.ts (основные таблицы)
-- - add-gender-column.ts (поле gender в players)
-- - add-teams.ts (таблицы команд)
-- - add-wins-column.ts (поле wins)
-- - add-wins-loses-columns.ts (поля wins и loses)
-- - create-player-tournament-points.ts (таблица очков игроков)
-- - fix-cup-position.ts (корректировка структуры)
-- - populate-gender.ts (заполнение пола - требует выполнения через приложение)
-- - remove-points-from-tournament-results.ts (удаление поля points)
-- - remove-position-enum-duplicates.ts (обновление enum)
-- - remove-tournament-from-teams.ts (глобальные команды)
-- - rename-cup-position-to-points-reason.ts (переименование поля)
-- - rename-wins-to-qualifying-wins.ts (переименование поля)
-- - restructure-teams-final.ts (окончательная структура команд)
-- - restructure-teams-simple.ts (упрощенная структура команд)
-- - restructure-teams.ts (изменения в структуре команд)
-- - update-gender.ts (обновление определения пола - требует выполнения через приложение)

-- ВАЖНО: 
-- 1. Определение пола игроков (populate-gender.ts, update-gender.ts) должно выполняться через приложение
-- 2. Данные о командах могут потребовать миграции при переходе со старой структуры
-- 3. Рейтинговые очки рассчитываются автоматически при загрузке турниров

-- Конец файла инициализации
