import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Матчи группового этапа: туры, счёт, дорожка.
 */

export async function up(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_group_matches'
  `);

  if (tables.length > 0) {
    console.log("  ✅ Таблица tournament_group_matches уже существует");
    return;
  }

  console.log("  📝 Создание таблицы tournament_group_matches...");

  await pool.execute(`
    CREATE TABLE tournament_group_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      group_number INT NOT NULL,
      round_number INT NOT NULL,
      team_a_id INT NOT NULL,
      team_b_id INT NOT NULL,
      score_a INT NULL DEFAULT NULL,
      score_b INT NULL DEFAULT NULL,
      court TINYINT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Номер дорожки',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_tournament_group_pair (tournament_id, group_number, team_a_id, team_b_id),
      KEY idx_tgm_tournament_group (tournament_id, group_number),
      KEY idx_tgm_round (tournament_id, group_number, round_number),
      CONSTRAINT fk_tgm_tournament FOREIGN KEY (tournament_id)
        REFERENCES tournaments(id) ON DELETE CASCADE,
      CONSTRAINT fk_tgm_team_a FOREIGN KEY (team_a_id)
        REFERENCES teams(id) ON DELETE CASCADE,
      CONSTRAINT fk_tgm_team_b FOREIGN KEY (team_b_id)
        REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("  ✅ Таблица tournament_group_matches создана");
}

export async function down(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_group_matches'
  `);

  if (tables.length === 0) {
    console.log("  ✅ Таблица tournament_group_matches уже удалена");
    return;
  }

  await pool.execute(`DROP TABLE tournament_group_matches`);
  console.log("  ✅ Таблица tournament_group_matches удалена");
}
