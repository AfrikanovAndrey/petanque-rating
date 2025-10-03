import { pool } from "../config/database";
import { addPointsToTournamentResultsAndDropPTP } from "./add-points-to-tournament-results-and-drop-ptp";
import { populateGender } from "./populate-gender";
import { updateGender } from "./update-gender";
import { linkLicensedPlayersWithPlayers } from "./link-licensed-players";
import { removePlayersWithInitials } from "./remove-players-with-initials";

/**
 * Миграции для системы с уже инициализированной БД
 * Выполняет только операции, которые требуют логики приложения
 */
export const runMigrations = async () => {
  try {
    console.log("🚀 Запуск миграций для инициализированной БД...");

    // Проверяем, что основные таблицы созданы
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('players', 'tournaments', 'teams', 'tournament_results')
    `);

    if ((tables as any[]).length < 4) {
      throw new Error(
        "Основные таблицы не найдены. Убедитесь, что база данных инициализирована через init-database.sql"
      );
    }

    console.log("✅ Основные таблицы найдены");

    // Выполняем критическую миграцию структуры/данных рейтинга очков
    console.log(
      "🧱 Миграция: перенос points в tournament_results и удаление player_tournament_points..."
    );
    await addPointsToTournamentResultsAndDropPTP();
    console.log("✅ Миграция очков выполнена");

    // Выполняем только операции, требующие логики приложения
    console.log("🚻 Заполнение пола для существующих игроков...");
    await populateGender();

    // console.log("🔄 Обновление пола игроков с улучшенным алгоритмом...");
    // await updateGender();

    console.log(
      "🔗 Связывание лицензионных игроков с основной таблицей players..."
    );
    await linkLicensedPlayersWithPlayers();

    console.log("🧹 Удаление игроков с инициалами вместо имени...");
    await removePlayersWithInitials();

    // Проверяем наличие базовых настроек
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
