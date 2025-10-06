import { pool } from "../config/database";

/**
 * Миграция:
 * 1) Добавить колонку points в tournament_results (если нет)
 * 2) Заполнить points из player_tournament_points
 * 3) Удалить таблицу player_tournament_points
 */
export async function addPointsToTournamentResultsAndDropPTP(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let colCheck;

    console.log(
      "🔄 Добавляем колонку category в tournaments (если отсутствует)..."
    );
    [colCheck] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tournaments'
         AND COLUMN_NAME = 'category'`
    );
    const hasCategory = (colCheck as any[])[0].count > 0;

    if (!hasCategory) {
      await connection.execute(
        "ALTER TABLE tournaments ADD COLUMN category ENUM('FEDERAL', 'REGIONAL') NOT NULL AFTER name;"
      );
      console.log("✓ Колонка category добавлена в tournaments");
    } else {
      console.log("ℹ️ Колонка category уже существует в tournament_results");
    }

    console.log(
      "🔄 Добавляем колонку teams_count в tournaments (если отсутствует)..."
    );
    [colCheck] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tournaments'
         AND COLUMN_NAME = 'teams_count'`
    );
    const hasTeamsCount = (colCheck as any[])[0].count > 0;

    if (!hasCategory) {
      await connection.execute(
        "ALTER TABLE tournaments ADD COLUMN teams_count INT NOT NULL AFTER category;"
      );
      console.log("✓ Колонка teams_count добавлена в tournaments");
    } else {
      console.log("ℹ️ Колонка teams_count уже существует в tournament_results");
    }

    await connection.commit();
    console.log("✅ Миграция завершена успешно");
  } catch (error) {
    await connection.rollback();
    console.error(
      "❌ Ошибка миграции addPointsToTournamentResultsAndDropPTP:",
      error
    );
    throw error;
  } finally {
    connection.release();
  }
}

// Экспорт для использования в migrate.ts при необходимости
export { addPointsToTournamentResultsAndDropPTP as migrate };

// Запуск миграции если скрипт вызван напрямую
if (require.main === module) {
  addPointsToTournamentResultsAndDropPTP()
    .then(() => {
      console.log("Миграция addPointsToTournamentResultsAndDropPTP завершена");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Ошибка миграции:", error);
      process.exit(1);
    });
}
