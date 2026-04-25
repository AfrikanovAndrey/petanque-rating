import { Pool, RowDataPacket } from "mysql2/promise";

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

  const [isConfirmedColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'is_confirmed'
  `);

  if (isConfirmedColumn.length === 0) {
    console.log("  📝 Добавление колонки is_confirmed...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN is_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER team_id
    `);
  } else {
    console.log("  ✅ Колонка is_confirmed уже существует");
  }

  const [confirmedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'confirmed_at'
  `);

  if (confirmedAtColumn.length === 0) {
    console.log("  📝 Добавление колонки confirmed_at...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN confirmed_at TIMESTAMP NULL DEFAULT NULL AFTER is_confirmed
    `);
  } else {
    console.log("  ✅ Колонка confirmed_at уже существует");
  }

  const [confirmedIndex] = await pool.execute<RowDataPacket[]>(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND INDEX_NAME = 'idx_tournament_confirmed'
  `);

  if (confirmedIndex.length === 0) {
    console.log("  📝 Добавление индекса idx_tournament_confirmed...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD KEY idx_tournament_confirmed (tournament_id, is_confirmed)
    `);
  } else {
    console.log("  ✅ Индекс idx_tournament_confirmed уже существует");
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

  const [confirmedIndex] = await pool.execute<RowDataPacket[]>(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND INDEX_NAME = 'idx_tournament_confirmed'
  `);

  if (confirmedIndex.length > 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP INDEX idx_tournament_confirmed
    `);
  }

  const [confirmedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'confirmed_at'
  `);

  if (confirmedAtColumn.length > 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN confirmed_at
    `);
  }

  const [isConfirmedColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'is_confirmed'
  `);

  if (isConfirmedColumn.length > 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN is_confirmed
    `);
  }
}
