import { pool } from "../config/database";

/**
 * Миграция для удаления колонки points из таблицы tournament_results
 * После того, как данные перенесены в player_tournament_points
 */
export async function removePointsFromTournamentResults(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🔄 Начинаем удаление колонки points из tournament_results...");

    // 1. Проверяем, что таблица player_tournament_points существует
    const [tableExists] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'player_tournament_points'
    `);

    if ((tableExists as any[])[0].count === 0) {
      throw new Error(
        "Таблица player_tournament_points не существует. Сначала запустите миграцию create-player-tournament-points."
      );
    }

    // Получаем количество записей для логирования (но не требуем их наличия)
    const [tournamentResultsCount] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM tournament_results
      WHERE points_reason IS NOT NULL AND points_reason != ''
    `);

    const [playerTournamentPointsCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_tournament_points
    `);

    const oldCount = (tournamentResultsCount as any[])[0].count;
    const newCount = (playerTournamentPointsCount as any[])[0].count;

    console.log(`📊 Проверка данных:`);
    console.log(`   - Записей в tournament_results: ${oldCount}`);
    console.log(`   - Записей в player_tournament_points: ${newCount}`);
    console.log(
      `   - Таблица player_tournament_points может быть пуста, если турниры ещё не загружались`
    );

    // 2. Проверяем, существует ли колонка points
    const [columnCheck] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_results'
      AND COLUMN_NAME = 'points'
    `);

    const hasPointsColumn = (columnCheck as any[])[0].count > 0;

    if (!hasPointsColumn) {
      console.log("ℹ️ Колонка points в tournament_results уже не существует");
      await connection.commit();
      return;
    }

    // 3. Удаляем колонку points из tournament_results
    console.log("🗑️ Удаляем колонку points из tournament_results...");

    await connection.execute(`
      ALTER TABLE tournament_results DROP COLUMN points
    `);

    console.log("✓ Колонка points удалена из tournament_results");

    // 4. Проверяем, что колонка успешно удалена
    const [finalCheck] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_results'
      AND COLUMN_NAME = 'points'
    `);

    if ((finalCheck as any[])[0].count > 0) {
      throw new Error(
        "Ошибка: колонка points не была удалена из tournament_results"
      );
    }

    console.log("✅ Колонка points успешно удалена из tournament_results");

    await connection.commit();
    console.log(
      "✅ Миграция удаления points из tournament_results завершена успешно!"
    );
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Экспорт для использования в migrate.ts
export { removePointsFromTournamentResults as migrate };
