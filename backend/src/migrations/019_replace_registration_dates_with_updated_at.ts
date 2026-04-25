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

  const [updatedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'updated_at'
  `);

  if (updatedAtColumn.length === 0) {
    console.log("  📝 Добавление колонки updated_at...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER team_id
    `);
  } else {
    console.log("  ✅ Колонка updated_at уже существует");
  }

  const [createdAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'created_at'
  `);

  const [confirmedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'confirmed_at'
  `);

  if (createdAtColumn.length > 0 && confirmedAtColumn.length > 0) {
    await pool.execute(`
      UPDATE tournament_registrations
      SET updated_at = COALESCE(confirmed_at, created_at, updated_at)
    `);
  } else if (createdAtColumn.length > 0) {
    await pool.execute(`
      UPDATE tournament_registrations
      SET updated_at = COALESCE(created_at, updated_at)
    `);
  } else if (confirmedAtColumn.length > 0) {
    await pool.execute(`
      UPDATE tournament_registrations
      SET updated_at = COALESCE(confirmed_at, updated_at)
    `);
  }

  if (confirmedAtColumn.length > 0) {
    console.log("  📝 Удаление колонки confirmed_at...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN confirmed_at
    `);
  } else {
    console.log("  ✅ Колонка confirmed_at уже удалена");
  }

  if (createdAtColumn.length > 0) {
    console.log("  📝 Удаление колонки created_at...");
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN created_at
    `);
  } else {
    console.log("  ✅ Колонка created_at уже удалена");
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

  const [createdAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'created_at'
  `);

  if (createdAtColumn.length === 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
  }

  const [confirmedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'confirmed_at'
  `);

  if (confirmedAtColumn.length === 0) {
    await pool.execute(`
      ALTER TABLE tournament_registrations
      ADD COLUMN confirmed_at TIMESTAMP NULL DEFAULT NULL
    `);
  }

  const [updatedAtColumn] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_registrations'
      AND COLUMN_NAME = 'updated_at'
  `);

  if (updatedAtColumn.length > 0) {
    await pool.execute(`
      UPDATE tournament_registrations
      SET created_at = updated_at,
          confirmed_at = CASE WHEN is_confirmed = 1 THEN updated_at ELSE NULL END
    `);
    await pool.execute(`
      ALTER TABLE tournament_registrations
      DROP COLUMN updated_at
    `);
  }
}
