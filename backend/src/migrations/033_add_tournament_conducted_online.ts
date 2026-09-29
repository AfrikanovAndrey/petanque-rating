import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Флаг: турнир ведётся в системе (группы/швейцарка/кубки).
 * false — итоги загружаются из Excel/Google на финальной регистрации.
 */
export async function up(pool: Pool): Promise<void> {
  const [existing] = await pool.execute<RowDataPacket[]>(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'conducted_online'
    `,
  );

  if (existing.length > 0) {
    console.log("⏭️  tournaments.conducted_online уже существует");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments
    ADD COLUMN conducted_online TINYINT(1) NOT NULL DEFAULT 1
      COMMENT '1 — проведение в системе; 0 — загрузка результатов из файла'
      AFTER manual
  `);
  console.log("✅ tournaments.conducted_online добавлено");
}
