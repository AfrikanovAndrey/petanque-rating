import { pool } from "../config/database";
import fs from "fs";
import path from "path";

/**
 * Система миграций базы данных (TypeScript)
 *
 * Миграции самоконтролирующие - каждая проверяет сама, нужно ли ее применять.
 * Не используется отдельная таблица для отслеживания миграций.
 *
 * Данный скрипт выполняет:
 * 1. Проверку наличия основных таблиц
 * 2. Автоматическое применение всех TypeScript миграций из папки migrations/
 * 3. Создание базовых настроек (если отсутствуют)
 *
 * Запуск: npm run check-db
 */

interface Migration {
  up: (pool: any) => Promise<void>;
  down?: (pool: any) => Promise<void>;
}

/**
 * Применить TypeScript миграцию
 */
const applyMigration = async (migrationPath: string, migrationName: string) => {
  try {
    // Импортируем TypeScript миграцию
    const migration: Migration = await import(migrationPath);

    // Проверяем наличие функции up
    if (typeof migration.up !== "function") {
      throw new Error(`Миграция ${migrationName} не содержит функцию up()`);
    }

    // Выполняем миграцию (она сама контролирует, нужно ли применение)
    await migration.up(pool);
  } catch (error) {
    console.error(`❌ Ошибка при применении миграции ${migrationName}:`, error);
    throw error;
  }
};

/**
 * Применить все миграции
 */
const applyMigrations = async () => {
  const migrationsDir = __dirname;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => {
      // Ищем TypeScript файлы миграций (не migrate.ts)
      return (
        (file.endsWith(".ts") || file.endsWith(".js")) &&
        file !== "migrate.ts" &&
        file !== "migrate.js" &&
        !file.endsWith(".d.ts") &&
        /^\d{3}_/.test(file) // Начинается с трех цифр
      );
    })
    .sort(); // Сортируем для применения в правильном порядке

  if (files.length === 0) {
    console.log("📋 Миграции не найдены");
    return;
  }

  console.log(`📋 Найдено миграций: ${files.length}`);

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationName = file.replace(/\.(ts|js)$/, ""); // Убираем расширение

    console.log(`📝 Применение миграции: ${migrationName}...`);
    await applyMigration(migrationPath, migrationName);
  }

  console.log("✅ Все миграции применены");
};

export const runMigrations = async () => {
  try {
    console.log("🔍 Проверка инициализации БД...");

    // Проверяем, что основные таблицы созданы
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('players', 'tournaments', 'teams', 'tournament_results')
    `);

    if ((tables as any[]).length < 4) {
      throw new Error(
        "Основные таблицы не найдены. Убедитесь, что база данных инициализирована через mysql/init/01-init.sql"
      );
    }

    console.log("✅ Структура БД инициализирована");

    // Применяем миграции (они самоконтролирующие)
    await applyMigrations();

    // Проверяем наличие базовых настроек (они должны быть созданы в 01-init.sql, но на всякий случай проверим)
    const [settings] = await pool.execute(
      "SELECT COUNT(*) as count FROM rating_settings WHERE setting_name IN ('best_results_count', 'current_season')"
    );

    if ((settings as any[])[0].count < 2) {
      console.log("🌱 Добавление базовых настроек...");
      await pool.execute(`
        INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) VALUES 
          ('best_results_count', '8', 'Количество лучших результатов для подсчета рейтинга'),
          ('current_season', '2025', 'Текущий сезон')
      `);
    }

    console.log("✅ БД готова к работе");
  } catch (error) {
    console.error("❌ Ошибка при проверке БД:", error);
    throw error;
  }
};

// Запуск проверки если скрипт вызван напрямую
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Проверка БД завершена успешно");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка проверки БД:", error);
      process.exit(1);
    });
}
