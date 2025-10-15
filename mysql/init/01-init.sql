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
  city VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_gender (gender),
  INDEX idx_city (city)
);

-- Таблица турниров
CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category ENUM('FEDERAL', 'REGIONAL') NOT NULL DEFAULT 'REGIONAL',
  teams_count INT NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_category (category)
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
  cup ENUM('A', 'B', 'C') NULL,
  qualifying_wins INT DEFAULT 0,
  wins INT DEFAULT 0,
  loses INT DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_tournament_team (tournament_id, team_id),
  INDEX idx_tournament_cup (tournament_id, cup),
  INDEX idx_cup_position (cup_position),
  INDEX idx_qualifying_wins (qualifying_wins),
  INDEX idx_wins (wins),
  INDEX idx_loses (loses),
  INDEX idx_points (points DESC)
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

-- Таблица пользователей (users)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Фамилия Имя',
  username VARCHAR(100) NOT NULL UNIQUE COMMENT 'Логин пользователя',
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'MANAGER') NOT NULL DEFAULT 'MANAGER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица логов аудита
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'ID пользователя, совершившего действие',
  username VARCHAR(100) NOT NULL COMMENT 'Имя пользователя для удобства',
  user_role ENUM('ADMIN', 'MANAGER') NOT NULL COMMENT 'Роль пользователя на момент действия',
  action VARCHAR(100) NOT NULL COMMENT 'Тип действия (CREATE, UPDATE, DELETE, LOGIN, etc.)',
  entity_type VARCHAR(50) NULL COMMENT 'Тип сущности (tournament, player, team, user, etc.)',
  entity_id INT NULL COMMENT 'ID сущности, над которой совершено действие',
  entity_name VARCHAR(255) NULL COMMENT 'Название сущности для удобства чтения',
  description TEXT NULL COMMENT 'Подробное описание действия',
  ip_address VARCHAR(45) NULL COMMENT 'IP адрес пользователя (поддержка IPv6)',
  user_agent TEXT NULL COMMENT 'User Agent браузера',
  request_method VARCHAR(10) NULL COMMENT 'HTTP метод (GET, POST, PUT, DELETE)',
  request_url VARCHAR(500) NULL COMMENT 'URL запроса',
  request_body JSON NULL COMMENT 'Тело запроса (без чувствительных данных)',
  changes JSON NULL COMMENT 'Изменения в формате JSON (old/new values)',
  success BOOLEAN DEFAULT TRUE COMMENT 'Успешность операции',
  error_message TEXT NULL COMMENT 'Сообщение об ошибке, если не успешно',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Время выполнения действия',
  INDEX idx_user_id (user_id),
  INDEX idx_username (username),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_success (success),
  INDEX idx_user_action (user_id, action),
  INDEX idx_entity_type (entity_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Логи действий пользователей в системе';

-- ========================================
-- 3. НАЧАЛЬНЫЕ ДАННЫЕ
-- ========================================

-- Настройки по умолчанию
INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
  ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
  ('current_season', '2025', 'Текущий сезон');
