import { pool } from "../config/database";

/**
 * Миграция для оптимизации индексов таблицы player_tournament_points
 * Добавляет дополнительные индексы для улучшения производительности запросов
 */
export async function optimizePlayerPointsIndexes(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log(
      "🔄 Начинаем оптимизацию индексов таблицы player_tournament_points..."
    );

    // Проверяем существование таблицы
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'player_tournament_points'
    `);

    if ((tables as any[]).length === 0) {
      console.log(
        "⚠️ Таблица player_tournament_points не найдена, пропускаем оптимизацию"
      );
      return;
    }

    // Проверяем существующие индексы
    const [existingIndexes] = await connection.execute(`
      SHOW INDEX FROM player_tournament_points
    `);

    const indexNames = (existingIndexes as any[]).map(
      (idx: any) => idx.Key_name
    );

    // Добавляем недостающие индексы
    if (!indexNames.includes("idx_player_tournament_points")) {
      console.log("➕ Добавляем индекс idx_player_tournament_points...");
      await connection.execute(`
        CREATE INDEX idx_player_tournament_points
        ON player_tournament_points (player_id, tournament_id, points)
      `);
    }

    if (!indexNames.includes("idx_tournament_created")) {
      console.log("➕ Добавляем индекс idx_tournament_created...");
      await connection.execute(`
        CREATE INDEX idx_tournament_created
        ON player_tournament_points (tournament_id, created_at)
      `);
    }

    // Оптимизируем существующие индексы если нужно
    console.log("✓ Проверка и оптимизация индексов завершена");

    await connection.commit();
    console.log(
      "✅ Оптимизация индексов таблицы player_tournament_points завершена успешно!"
    );
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка оптимизации индексов:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Экспорт для использования в migrate.ts
export { optimizePlayerPointsIndexes as migrate };
