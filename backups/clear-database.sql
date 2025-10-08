-- ========================================
-- Скрипт полной очистки данных БД
-- ========================================
-- 
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из таблиц!
-- Используйте только для тестирования или полной переустановки.
-- 
-- Применение:
-- docker exec -i petanque-mysql mysql -u root -p petanque_rating < clear-database.sql
-- 
-- ========================================

USE petanque_rating;

-- Отключаем проверку внешних ключей
SET FOREIGN_KEY_CHECKS = 0;

-- Очищаем все таблицы
TRUNCATE TABLE tournament_results;
TRUNCATE TABLE team_players;
TRUNCATE TABLE teams;
TRUNCATE TABLE player_tournament_points;
TRUNCATE TABLE licensed_players;
TRUNCATE TABLE players;
TRUNCATE TABLE tournaments;

-- Оставляем настройки и администраторов (раскомментируйте если нужно очистить)
-- TRUNCATE TABLE rating_settings;
-- TRUNCATE TABLE admins;

-- Включаем обратно проверку внешних ключей
SET FOREIGN_KEY_CHECKS = 1;

-- Восстанавливаем базовые настройки (если были удалены)
INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
  ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
  ('current_season', '2025', 'Текущий сезон');

SELECT 'База данных очищена!' as Status;
SELECT 'Настройки и администраторы сохранены.' as Note;

