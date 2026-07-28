import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Финальная часть: конфиг кубков + матчи сеток (AB / A / B / C / D).
 * Также расширяет ENUM cup в tournament_results значением 'D'.
 */

export async function up(pool: Pool): Promise<void> {
  const [configCol] = await pool.execute<RowDataPacket[]>(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'cup_stage_config'
  `,
  );

  if (configCol.length === 0) {
    await pool.execute(`
      ALTER TABLE tournaments
      ADD COLUMN cup_stage_config JSON NULL DEFAULT NULL
        COMMENT 'Конфиг финала: {a,b,c,d,ab_playoff}'
        AFTER group_draw
    `);
    console.log("✅ tournaments.cup_stage_config добавлено");
  } else {
    console.log("⏭️  tournaments.cup_stage_config уже существует");
  }

  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_cup_matches'
  `);

  if (tables.length === 0) {
    await pool.execute(`
      CREATE TABLE tournament_cup_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        cup ENUM('AB', 'A', 'B', 'C', 'D') NOT NULL,
        round_number INT NOT NULL,
        match_index INT NOT NULL,
        team_a_id INT NULL DEFAULT NULL,
        team_b_id INT NULL DEFAULT NULL,
        score_a INT NULL DEFAULT NULL,
        score_b INT NULL DEFAULT NULL,
        court TINYINT UNSIGNED NULL DEFAULT NULL,
        is_third_place TINYINT(1) NOT NULL DEFAULT 0,
        next_match_round INT NULL DEFAULT NULL,
        next_match_index INT NULL DEFAULT NULL,
        next_slot ENUM('a', 'b') NULL DEFAULT NULL,
        loser_next_match_round INT NULL DEFAULT NULL,
        loser_next_match_index INT NULL DEFAULT NULL,
        loser_next_slot ENUM('a', 'b') NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_tcm_slot (tournament_id, cup, round_number, match_index, is_third_place),
        KEY idx_tcm_tournament_cup (tournament_id, cup),
        CONSTRAINT fk_tcm_tournament FOREIGN KEY (tournament_id)
          REFERENCES tournaments(id) ON DELETE CASCADE,
        CONSTRAINT fk_tcm_team_a FOREIGN KEY (team_a_id)
          REFERENCES teams(id) ON DELETE SET NULL,
        CONSTRAINT fk_tcm_team_b FOREIGN KEY (team_b_id)
          REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Таблица tournament_cup_matches создана");
  } else {
    console.log("⏭️  Таблица tournament_cup_matches уже существует");
  }

  const [cupCol] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_results'
      AND COLUMN_NAME = 'cup'
  `);
  const columnType = String(cupCol[0]?.COLUMN_TYPE ?? "");
  if (columnType && !columnType.includes("'D'")) {
    await pool.execute(`
      ALTER TABLE tournament_results
      MODIFY COLUMN cup ENUM('A', 'B', 'C', 'D') NULL
    `);
    console.log("✅ tournament_results.cup: добавлено значение D");
  } else if (columnType.includes("'D'")) {
    console.log("⏭️  tournament_results.cup уже содержит D");
  }
}
