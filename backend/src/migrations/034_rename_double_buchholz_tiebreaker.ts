import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";

/**
 * Миграция 034: DOUBLE_BUCHHOLZ → TOTAL_BUCHHOLZ в tiebreaker_order турниров.
 */

export async function up(): Promise<void> {
  console.log("  🔍 Проверка tiebreaker_order на DOUBLE_BUCHHOLZ...");

  const [rows] = await pool.execute<RowDataPacket[]>(`
    SELECT COUNT(*) AS cnt
    FROM tournaments
    WHERE tiebreaker_order IS NOT NULL
      AND tiebreaker_order LIKE '%DOUBLE_BUCHHOLZ%'
  `);

  const cnt = Number(rows[0]?.cnt ?? 0);
  if (cnt === 0) {
    console.log("  ✅ Записей с DOUBLE_BUCHHOLZ нет");
    return;
  }

  console.log(`  📝 Обновление tiebreaker_order в ${cnt} турнире(ах)...`);
  await pool.execute(`
    UPDATE tournaments
    SET tiebreaker_order = REPLACE(
      tiebreaker_order,
      '"DOUBLE_BUCHHOLZ"',
      '"TOTAL_BUCHHOLZ"'
    )
    WHERE tiebreaker_order IS NOT NULL
      AND tiebreaker_order LIKE '%DOUBLE_BUCHHOLZ%'
  `);
  console.log("  ✅ DOUBLE_BUCHHOLZ заменён на TOTAL_BUCHHOLZ");
}
