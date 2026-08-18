import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция 028: дата вступления игрока в клуб (club_members.joined_at).
 * Для существующих записей копируется из DATE(created_at).
 */
export async function up(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'club_members'
  `);

  if (tables.length === 0) {
    console.log("⏭️  Таблица club_members не найдена, пропускаем");
    return;
  }

  const [cols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'club_members'
      AND COLUMN_NAME = 'joined_at'
  `);

  if (cols.length > 0) {
    console.log("⏭️  club_members.joined_at уже существует");
    return;
  }

  await pool.execute(`
    ALTER TABLE club_members
      ADD COLUMN joined_at DATE NULL
        COMMENT 'Дата вступления игрока в клуб'
        AFTER player_id
  `);

  await pool.execute(`
    UPDATE club_members
    SET joined_at = DATE(created_at)
    WHERE joined_at IS NULL
  `);

  await pool.execute(`
    ALTER TABLE club_members
      MODIFY COLUMN joined_at DATE NOT NULL
        DEFAULT (CURRENT_DATE)
        COMMENT 'Дата вступления игрока в клуб'
  `);

  console.log("✅ club_members.joined_at добавлен");
}
