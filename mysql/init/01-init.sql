-- Создание базы данных (уже создана через docker-compose)
-- USE petanque_rating;

-- Установка кодировки
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Создание таблиц будет выполнено через миграции backend приложения
-- Здесь можно добавить дополнительные настройки MySQL если потребуется

-- Настройка часового пояса
SET time_zone = '+00:00';

-- Оптимизация для разработки
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
