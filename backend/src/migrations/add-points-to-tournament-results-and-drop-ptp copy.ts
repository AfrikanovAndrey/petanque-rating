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

    console.log(
      "🔄 Добавляем колонку points в tournament_results (если отсутствует)..."
    );
    const [colCheck] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tournament_results'
         AND COLUMN_NAME = 'points'`
    );
    const hasPoints = (colCheck as any[])[0].count > 0;

    if (!hasPoints) {
      await connection.execute(
        "ALTER TABLE tournament_results ADD COLUMN points INT NOT NULL DEFAULT 0 AFTER qualifying_wins"
      );
      console.log("✓ Колонка points добавлена в tournament_results");
    } else {
      console.log("ℹ️ Колонка points уже существует в tournament_results");
    }

    // Если есть таблица player_tournament_points — переносим данные
    const [ptpTableCheck] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'player_tournament_points'`
    );
    const hasPTP = (ptpTableCheck as any[])[0].count > 0;

    if (hasPTP) {
      console.log(
        "📥 Переносим points из player_tournament_points в tournament_results..."
      );
      // Заполняем points по соответствию tournament_id + team_id (через team_players)
      await connection.execute(
        `UPDATE tournament_results tr
         JOIN team_players tp ON tr.team_id = tp.team_id
         JOIN player_tournament_points ptp ON ptp.player_id = tp.player_id AND ptp.tournament_id = tr.tournament_id
         SET tr.points = GREATEST(tr.points, ptp.points)`
      );
      console.log("✓ Значения points перенесены в tournament_results");

      console.log("🗑️ Удаляем таблицу player_tournament_points...");
      await connection.execute("DROP TABLE IF EXISTS player_tournament_points");
      console.log("✓ Таблица player_tournament_points удалена");
    } else {
      console.log(
        "ℹ️ Таблица player_tournament_points отсутствует — шаг переноса пропущен"
      );
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
