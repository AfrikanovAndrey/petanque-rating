import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * JSON-заявка состава (игрок из базы / новый текстом) для турнирной регистрации.
 */
export async function up(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
  `);

  if (tables.length === 0) {
    console.log(
      "  ⚠️ Таблица tournament_registrations не найдена, миграция пропущена",
    );
    return;
  }

  const [col] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'registration_roster_json'
  `);

  if (col.length === 0) {
    console.log("  📝 Добавление колонки registration_roster_json...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN registration_roster_json JSON NULL DEFAULT NULL
        AFTER is_confirmed
    `);
  } else {
    console.log("  ✅ Колонка registration_roster_json уже существует");
  }
}

export async function down(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
  `);

  if (tables.length === 0) {
    return;
  }

  const [col] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'registration_roster_json'
  `);

  if (col.length > 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN registration_roster_json
    `);
  }
}
