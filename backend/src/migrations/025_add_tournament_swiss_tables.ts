import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Таблицы для проведения швейцарской системы: туры, матчи, таблица.
 */
export async function up(pool: Pool): Promise<void> {
  const [roundsTable] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_swiss_rounds'
  `);

  if (roundsTable.length === 0) {
    await pool.execute(`
      CREATE TABLE tournament_swiss_rounds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        round_number TINYINT UNSIGNED NOT NULL,
        status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
        completed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tournament_round (tournament_id, round_number),
        KEY idx_tournament (tournament_id),
        CONSTRAINT fk_tsr_tournament
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ tournament_swiss_rounds создана");
  } else {
    console.log("⏭️  tournament_swiss_rounds уже существует");
  }

  const [matchesTable] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_swiss_matches'
  `);

  if (matchesTable.length === 0) {
    await pool.execute(`
      CREATE TABLE tournament_swiss_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        round_id INT NOT NULL,
        team_a_id INT NOT NULL,
        team_b_id INT NULL DEFAULT NULL,
        score_a TINYINT UNSIGNED NULL DEFAULT NULL,
        score_b TINYINT UNSIGNED NULL DEFAULT NULL,
        winner_team_id INT NULL DEFAULT NULL,
        is_bye TINYINT(1) NOT NULL DEFAULT 0,
        played_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_tournament (tournament_id),
        KEY idx_round (round_id),
        KEY idx_team_a (team_a_id),
        KEY idx_team_b (team_b_id),
        UNIQUE KEY uq_round_team_a (round_id, team_a_id),
        CONSTRAINT fk_tsm_tournament
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        CONSTRAINT fk_tsm_round
          FOREIGN KEY (round_id) REFERENCES tournament_swiss_rounds(id) ON DELETE CASCADE,
        CONSTRAINT fk_tsm_team_a
          FOREIGN KEY (team_a_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT fk_tsm_team_b
          FOREIGN KEY (team_b_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT fk_tsm_winner
          FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ tournament_swiss_matches создана");
  } else {
    console.log("⏭️  tournament_swiss_matches уже существует");
  }

  const [standingsTable] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_swiss_standings'
  `);

  if (standingsTable.length === 0) {
    await pool.execute(`
      CREATE TABLE tournament_swiss_standings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        team_id INT NOT NULL,
        wins INT NOT NULL DEFAULT 0,
        loses INT NOT NULL DEFAULT 0,
        points_for INT NOT NULL DEFAULT 0,
        points_against INT NOT NULL DEFAULT 0,
        buchholz DECIMAL(10,2) NULL DEFAULT NULL,
        double_buchholz DECIMAL(10,2) NULL DEFAULT NULL,
        berger DECIMAL(10,2) NULL DEFAULT NULL,
        progress DECIMAL(10,2) NULL DEFAULT NULL,
        point_diff INT NOT NULL DEFAULT 0,
        rank_position INT NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tournament_team (tournament_id, team_id),
        KEY idx_tournament_rank (tournament_id, rank_position),
        CONSTRAINT fk_tss_tournament
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        CONSTRAINT fk_tss_team
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ tournament_swiss_standings создана");
  } else {
    console.log("⏭️  tournament_swiss_standings уже существует");
  }
}
