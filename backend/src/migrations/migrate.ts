import { pool } from "../config/database";

/**
 * Проверка инициализации базы данных
 *
 * ВАЖНО: Этот файл НЕ содержит миграций структуры БД.
 * Все структурные изменения находятся в /mysql/init/01-init.sql
 *
 * Данный скрипт выполняет только:
 * 1. Проверку наличия основных таблиц
 * 2. Создание базовых настроек (если отсутствуют)
 *
 * Запуск: npm run check-db
 */
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
