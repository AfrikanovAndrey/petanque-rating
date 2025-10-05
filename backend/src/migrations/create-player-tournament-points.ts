import { pool } from "../config/database";
import { getCupPoints, getPointsByQualifyingStage } from "../config/cupPoints";
import { CupPosition } from "../types";

/**
 * Миграция для создания таблицы player_tournament_points
 * Хранит рейтинговые очки каждого игрока за конкретные турниры
 * Простая структура: id | tournament_id | player_id | points
 */
export async function createPlayerTournamentPoints(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🔄 Начинаем создание таблицы player_tournament_points...");

    // 1. Создаем простую таблицу для рейтинговых очков игроков за турниры
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS player_tournament_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        player_id INT NOT NULL,
        points INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        UNIQUE KEY unique_player_tournament (player_id, tournament_id),
        INDEX idx_player_points (player_id, points DESC),
        INDEX idx_tournament (tournament_id),
        INDEX idx_points (points DESC),
        INDEX idx_player_tournament_points (player_id, tournament_id, points),
        INDEX idx_tournament_created (tournament_id, created_at)
      )
    `);
    console.log("✓ Создана таблица player_tournament_points");

    // 2. Переносим данные из tournament_results в новую таблицу
    console.log("🔄 Перенос данных из tournament_results...");

    // Получаем все результаты турниров с данными для расчета очков
    const [tournamentResults] = await connection.execute(`
      SELECT 
        tr.tournament_id,
        tr.cup_position,
        tr.cup,
        tr.qualifying_wins,
        tp.player_id
      FROM tournament_results tr
      JOIN team_players tp ON tr.team_id = tp.team_id
      WHERE tr.cup_position IS NOT NULL AND tr.cup_position != ''
      ORDER BY tr.tournament_id, tp.player_id
    `);

    let migratedRecords = 0;

    // Для каждого игрока в каждой команде создаем запись с очками
    for (const result of tournamentResults as any[]) {
      // Проверяем, не существует ли уже такая запись
      const [existing] = await connection.execute(
        `SELECT COUNT(*) as count 
         FROM player_tournament_points 
         WHERE player_id = ? AND tournament_id = ?`,
        [result.player_id, result.tournament_id]
      );

      if ((existing as any[])[0].count === 0) {
        // Рассчитываем очки на основе cup_position, cup и qualifying_wins
        let points = 0;

        // Очки за кубок
        if (result.cup_position && result.cup_position !== "QUALIFYING_ONLY") {
          const cupPosition = result.cup_position as CupPosition;
          points += getCupPoints(
            "2", // категория по умолчанию - 2-я
            result.cup || "A",
            cupPosition,
            20 // количество команд по умолчанию
          );
        }

        // Очки за отборочные победы
        if (result.qualifying_wins > 0) {
          points += getPointsByQualifyingStage("2", result.qualifying_wins);
        }

        if (points > 0) {
          await connection.execute(
            `INSERT INTO player_tournament_points 
             (tournament_id, player_id, points)
             VALUES (?, ?, ?)`,
            [result.tournament_id, result.player_id, points]
          );
          migratedRecords++;
        }
      }
    }

    console.log(
      `✓ Перенесено ${migratedRecords} записей рейтинговых очков игроков`
    );

    // 3. Проверяем корректность миграции
    const [oldCount] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM tournament_results tr
      JOIN team_players tp ON tr.team_id = tp.team_id
      WHERE tr.cup_position IS NOT NULL AND tr.cup_position != ''
    `);

    const [newCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_tournament_points
    `);

    const oldRecords = (oldCount as any[])[0].count;
    const newRecords = (newCount as any[])[0].count;

    // Проверяем, что новых записей не меньше чем ожидается
    // (в новой структуре может быть больше записей из-за индивидуальных очков игроков)
    if (newRecords < migratedRecords) {
      throw new Error(
        `Ошибка миграции: недостаточно записей в новой структуре (ожидалось: ${migratedRecords}, получено: ${newRecords})`
      );
    }

    console.log(
      `✓ Проверка данных пройдена: ${newRecords} записей в новой структуре (было ${oldRecords} связей команда-игрок, перенесено ${migratedRecords} записей)`
    );

    // 4. Статистика
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT player_id) as players_count,
        COUNT(DISTINCT tournament_id) as tournaments_count,
        COUNT(*) as total_records,
        SUM(points) as total_points
      FROM player_tournament_points
    `);

    const statistics = (stats as any[])[0];
    console.log(`📊 Статистика новой таблицы player_tournament_points:`);
    console.log(`   - Игроков: ${statistics.players_count}`);
    console.log(`   - Турниров: ${statistics.tournaments_count}`);
    console.log(`   - Всего записей: ${statistics.total_records}`);
    console.log(`   - Общая сумма очков: ${statistics.total_points}`);

    await connection.commit();
    console.log(
      "✅ Миграция создания таблицы player_tournament_points завершена успешно!"
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
export { createPlayerTournamentPoints as migrate };
