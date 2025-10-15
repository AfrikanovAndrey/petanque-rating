import { TournamentModel } from "./src/models/TournamentModel";
import { pool } from "./src/config/database";

async function recalculate() {
  try {
    const tournamentId = process.argv[2] ? parseInt(process.argv[2]) : 12;

    console.log(`\n🔄 Запуск пересчёта очков для турнира ${tournamentId}...\n`);

    await TournamentModel.recalculateTournamentPoints(tournamentId);

    console.log(`\n✅ Пересчёт завершён!\n`);

    // Проверяем результат
    const [results] = await pool.execute(
      `SELECT id, cup, cup_position, qualifying_wins, points 
       FROM tournament_results 
       WHERE tournament_id = ? AND cup = 'A'
       ORDER BY FIELD(cup_position, '1', '2', '3', '1/2', '1/4', '1/8')
       LIMIT 5`,
      [tournamentId]
    );

    console.log("📊 Результаты кубка A после пересчёта:");
    console.table(results);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    await pool.end();
    process.exit(1);
  }
}

recalculate();
