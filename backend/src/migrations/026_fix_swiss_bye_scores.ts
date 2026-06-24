import { Pool, ResultSetHeader } from "mysql2/promise";
import {
  SWISS_BYE_SCORE_A,
  SWISS_BYE_SCORE_B,
} from "../services/swissConstants";

/**
 * Исправить счёт bye-матчей: 13:0 → 13:7.
 */
export async function up(pool: Pool): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
    UPDATE tournament_swiss_matches
    SET score_a = ?, score_b = ?
    WHERE is_bye = 1
      AND (score_b IS NULL OR score_b = 0)
    `,
    [SWISS_BYE_SCORE_A, SWISS_BYE_SCORE_B],
  );

  if (result.affectedRows > 0) {
    console.log(`✅ Обновлено bye-матчей: ${result.affectedRows} (счёт 13:7)`);
  } else {
    console.log("⏭️  bye-матчи уже с счётом 13:7 или таблица пуста");
  }
}
