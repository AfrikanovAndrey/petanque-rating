import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Дата фиксации рейтинга для посева и отображения рейтинга команд турнира.
 * NULL — использовать текущий рейтинг.
 */
export async function up(pool: Pool): Promise<void> {
  const [existing] = await pool.execute<RowDataPacket[]>(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'rating_fixed_date'
    `,
  );

  if (existing.length > 0) {
    console.log("⏭️  tournaments.rating_fixed_date уже существует");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments
    ADD COLUMN rating_fixed_date DATE NULL DEFAULT NULL
      COMMENT 'Фиксировать рейтинг игроков на эту дату (посев, таблица заявок)'
      AFTER date
  `);
  console.log("✅ tournaments.rating_fixed_date добавлено");
}
