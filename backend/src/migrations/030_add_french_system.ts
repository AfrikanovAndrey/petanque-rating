import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Французская система в группах из 4: верхняя и нижняя ветки, затем матч за 2–3 места.
 * Расширяет tournament_group_matches полями сетки (как у кубка).
 */

async function columnExists(
  pool: Pool,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(
  pool: Pool,
  table: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
    `,
    [table, indexName],
  );
  return rows.length > 0;
}

async function fkExists(
  pool: Pool,
  table: string,
  constraintName: string,
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
    SELECT CONSTRAINT_NAME
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_NAME = ?
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    LIMIT 1
    `,
    [table, constraintName],
  );
  return rows.length > 0;
}

export async function up(pool: Pool): Promise<void> {
  if (!(await columnExists(pool, "tournaments", "french_system"))) {
    await pool.execute(`
      ALTER TABLE tournaments
      ADD COLUMN french_system TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Французская система в группах из 4: 3 тура, матч за 2–3 места'
        AFTER group_size
    `);
    console.log("✅ tournaments.french_system добавлено");
  } else {
    console.log("⏭️  tournaments.french_system уже существует");
  }

  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournament_group_matches'
  `);
  if (tables.length === 0) {
    console.log("⏭️  tournament_group_matches нет — пропуск расширения");
    return;
  }

  const columnsToAdd: Array<{ name: string; ddl: string }> = [
    {
      name: "match_index",
      ddl: `ADD COLUMN match_index INT NOT NULL DEFAULT 0
        COMMENT 'Индекс матча в туре / слот сетки'
        AFTER round_number`,
    },
    {
      name: "is_third_place",
      ddl: `ADD COLUMN is_third_place TINYINT(1) NOT NULL DEFAULT 0
        AFTER court`,
    },
    {
      name: "next_match_round",
      ddl: `ADD COLUMN next_match_round INT NULL DEFAULT NULL AFTER is_third_place`,
    },
    {
      name: "next_match_index",
      ddl: `ADD COLUMN next_match_index INT NULL DEFAULT NULL AFTER next_match_round`,
    },
    {
      name: "next_slot",
      ddl: `ADD COLUMN next_slot ENUM('a', 'b') NULL DEFAULT NULL AFTER next_match_index`,
    },
    {
      name: "loser_next_match_round",
      ddl: `ADD COLUMN loser_next_match_round INT NULL DEFAULT NULL AFTER next_slot`,
    },
    {
      name: "loser_next_match_index",
      ddl: `ADD COLUMN loser_next_match_index INT NULL DEFAULT NULL AFTER loser_next_match_round`,
    },
    {
      name: "loser_next_slot",
      ddl: `ADD COLUMN loser_next_slot ENUM('a', 'b') NULL DEFAULT NULL AFTER loser_next_match_index`,
    },
  ];

  for (const column of columnsToAdd) {
    if (await columnExists(pool, "tournament_group_matches", column.name)) {
      console.log(`⏭️  tournament_group_matches.${column.name} уже существует`);
      continue;
    }
    await pool.execute(`ALTER TABLE tournament_group_matches ${column.ddl}`);
    console.log(`✅ tournament_group_matches.${column.name} добавлено`);
  }

  // Слоты сетки могут быть без команд до полуфиналов
  if (await fkExists(pool, "tournament_group_matches", "fk_tgm_team_a")) {
    await pool.execute(
      `ALTER TABLE tournament_group_matches DROP FOREIGN KEY fk_tgm_team_a`,
    );
  }
  if (await fkExists(pool, "tournament_group_matches", "fk_tgm_team_b")) {
    await pool.execute(
      `ALTER TABLE tournament_group_matches DROP FOREIGN KEY fk_tgm_team_b`,
    );
  }

  await pool.execute(`
    ALTER TABLE tournament_group_matches
      MODIFY COLUMN team_a_id INT NULL DEFAULT NULL,
      MODIFY COLUMN team_b_id INT NULL DEFAULT NULL
  `);

  if (!(await fkExists(pool, "tournament_group_matches", "fk_tgm_team_a"))) {
    await pool.execute(`
      ALTER TABLE tournament_group_matches
        ADD CONSTRAINT fk_tgm_team_a FOREIGN KEY (team_a_id)
          REFERENCES teams(id) ON DELETE SET NULL
    `);
  }
  if (!(await fkExists(pool, "tournament_group_matches", "fk_tgm_team_b"))) {
    await pool.execute(`
      ALTER TABLE tournament_group_matches
        ADD CONSTRAINT fk_tgm_team_b FOREIGN KEY (team_b_id)
          REFERENCES teams(id) ON DELETE SET NULL
    `);
  }

  await pool.execute(`
    UPDATE tournament_group_matches t
    JOIN (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY tournament_id, group_number, round_number, is_third_place
               ORDER BY id
             ) - 1 AS idx
      FROM tournament_group_matches
    ) x ON t.id = x.id
    SET t.match_index = x.idx
  `);

  if (await indexExists(pool, "tournament_group_matches", "uniq_tournament_group_pair")) {
    await pool.execute(
      `ALTER TABLE tournament_group_matches DROP INDEX uniq_tournament_group_pair`,
    );
    console.log("✅ uniq_tournament_group_pair удалён");
  }

  if (!(await indexExists(pool, "tournament_group_matches", "uniq_tgm_slot"))) {
    await pool.execute(`
      ALTER TABLE tournament_group_matches
        ADD UNIQUE KEY uniq_tgm_slot
          (tournament_id, group_number, round_number, match_index, is_third_place)
    `);
    console.log("✅ uniq_tgm_slot добавлен");
  }
}
