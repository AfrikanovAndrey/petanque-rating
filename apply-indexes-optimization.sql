-- ========================================
-- Оптимизация индексов для таблицы player_tournament_points
-- Применить после создания таблицы player_tournament_points
-- ========================================

-- Проверяем существование таблицы
SELECT 'Проверяем таблицу player_tournament_points...' as status;

-- Проверяем существующие индексы
SHOW INDEX FROM player_tournament_points;

-- Добавляем дополнительные индексы для оптимизации
SELECT 'Добавляем индекс idx_player_tournament_points...' as status;
CREATE INDEX IF NOT EXISTS idx_player_tournament_points
ON player_tournament_points (player_id, tournament_id, points);

SELECT 'Добавляем индекс idx_tournament_created...' as status;
CREATE INDEX IF NOT EXISTS idx_tournament_created
ON player_tournament_points (tournament_id, created_at);

-- Проверяем индексы после добавления
SELECT 'Проверяем индексы после оптимизации...' as status;
SHOW INDEX FROM player_tournament_points;

-- Анализируем таблицу для оптимизатора
SELECT 'Анализируем таблицу для оптимизатора запросов...' as status;
ANALYZE TABLE player_tournament_points;

SELECT 'Оптимизация индексов завершена!' as status;
