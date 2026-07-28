import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Швейцарская система: сид команд + матчи по турам.
 */

async function ensureSwissMatchesTable(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_swiss_matches'
  `);

  if (tables.length > 0) {
    const [cols] = await pool.execute<RowDataPacket[]>(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tournament_swiss_matches'
        AND COLUMN_NAME = 'round_number'
    `);
    if (cols.length > 0) {
      console.log("  ✅ Таблица tournament_swiss_matches уже актуальна");
      return;
    }

    // Старая/черновая схема (например, round_id без round_number) — пересоздаём
    console.log(
      "  📝 Пересоздание tournament_swiss_matches под актуальную схему...",
    );
    await pool.execute(`DROP TABLE tournament_swiss_matches`);
  } else {
    console.log("  📝 Создание таблицы tournament_swiss_matches...");
  }

  await pool.execute(`
    CREATE TABLE tournament_swiss_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      round_number INT NOT NULL,
      team_a_id INT NOT NULL,
      team_b_id INT NULL DEFAULT NULL
        COMMENT 'NULL при bye',
      score_a INT NULL DEFAULT NULL,
      score_b INT NULL DEFAULT NULL,
      is_bye TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Автопобеда без соперника',
      court TINYINT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Номер дорожки',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tsm_tournament_round (tournament_id, round_number),
      KEY idx_tsm_tournament (tournament_id),
      CONSTRAINT fk_tsm_tournament FOREIGN KEY (tournament_id)
        REFERENCES tournaments(id) ON DELETE CASCADE,
      CONSTRAINT fk_tsm_team_a FOREIGN KEY (team_a_id)
        REFERENCES teams(id) ON DELETE CASCADE,
      CONSTRAINT fk_tsm_team_b FOREIGN KEY (team_b_id)
        REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("  ✅ Таблица tournament_swiss_matches создана");
}

export async function up(pool: Pool): Promise<void> {
  const [seedCols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'swiss_seed'
  `);

  if (seedCols.length === 0) {
    console.log("  📝 Добавление tournaments.swiss_seed...");
    await pool.execute(`
      ALTER TABLE tournaments
      ADD COLUMN swiss_seed JSON NULL DEFAULT NULL
        COMMENT 'Сиды швейцарки: [{team_id, seed, rating, random_tie}]'
        AFTER tiebreaker_order
    `);
    console.log("  ✅ tournaments.swiss_seed добавлено");
  } else {
    console.log("  ⏭️  tournaments.swiss_seed уже существует");
  }

  await ensureSwissMatchesTable(pool);
}

export async function down(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_swiss_matches'
  `);

  if (tables.length > 0) {
    await pool.execute(`DROP TABLE tournament_swiss_matches`);
    console.log("  ✅ Таблица tournament_swiss_matches удалена");
  }

  const [seedCols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'swiss_seed'
  `);

  if (seedCols.length > 0) {
    await pool.execute(`ALTER TABLE tournaments DROP COLUMN swiss_seed`);
    console.log("  ✅ tournaments.swiss_seed удалён");
  }
}
