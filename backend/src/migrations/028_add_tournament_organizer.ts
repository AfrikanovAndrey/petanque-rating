import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Организатор турнира: пользователь, создавший турнир.
 * Мутации и управление — только он или ADMIN.
 */

export async function up(pool: Pool): Promise<void> {
  const [cols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'organizer_user_id'
  `);

  if (cols.length > 0) {
    console.log("  ✅ tournaments.organizer_user_id уже существует");
    return;
  }

  console.log("  📝 Добавление tournaments.organizer_user_id...");
  await pool.execute(`
    ALTER TABLE tournaments
      ADD COLUMN organizer_user_id INT NULL DEFAULT NULL
        COMMENT 'Пользователь-организатор турнира (создатель)'
        AFTER results_validated_at,
      ADD CONSTRAINT fk_tournaments_organizer_user
        FOREIGN KEY (organizer_user_id) REFERENCES users(id)
        ON DELETE SET NULL
  `);
  console.log("  ✅ tournaments.organizer_user_id добавлено");
}
