import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Таблица записей команд на турнир (фаза регистрации до загрузки результатов).
 */

export async function up(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournament_registrations'
  `);

  if (tables.length > 0) {
    console.log("  ✅ Таблица tournament_registrations уже существует");
    return;
  }

  console.log("  📝 Создание таблицы tournament_registrations...");

  await pool.execute(`
    CREATE TABLE tournament_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      team_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_tournament_team (tournament_id, team_id),
      KEY idx_tournament (tournament_id),
      CONSTRAINT fk_tr_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      CONSTRAINT fk_tr_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("  ✅ Таблица tournament_registrations создана");
}

export async function down(pool: Pool): Promise<void> {
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournament_registrations'
  `);

  if (tables.length === 0) {
    console.log("  ✅ Таблица tournament_registrations уже удалена");
    return;
  }

  await pool.execute(`DROP TABLE tournament_registrations`);
  console.log("  ✅ Таблица tournament_registrations удалена");
}
