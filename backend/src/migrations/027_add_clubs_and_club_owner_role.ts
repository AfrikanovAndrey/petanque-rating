import { Pool, RowDataPacket } from "mysql2/promise";
import {
  ensureEnumValue,
  formatEnumSql,
  parseEnumValues,
} from "./enumColumnUtils";

/**
 * Миграция 027: сущность Club, роль CLUB_OWNER.
 * - clubs / club_owners / club_members
 * - владелец максимум в одном клубе (UNIQUE user_id)
 * - игрок максимум в одном клубе (UNIQUE player_id)
 */
export async function up(pool: Pool): Promise<void> {
  // --- Роль CLUB_OWNER в users.role ---
  const [userCol] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
  `);

  const userType = userCol[0]?.COLUMN_TYPE as string | undefined;
  const userValues = ensureEnumValue(parseEnumValues(userType), "CLUB_OWNER");
  if (!userType?.includes("CLUB_OWNER")) {
    await pool.execute(`
      ALTER TABLE users
      MODIFY COLUMN role ${formatEnumSql(userValues)}
        NOT NULL DEFAULT 'MANAGER'
    `);
    console.log("✅ users.role: добавлен CLUB_OWNER");
  } else {
    console.log("⏭️  users.role уже содержит CLUB_OWNER");
  }

  // --- Роль в audit_logs.user_role ---
  const [auditTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'audit_logs'
  `);

  if (auditTables.length > 0) {
    const [auditCol] = await pool.execute<RowDataPacket[]>(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
        AND COLUMN_NAME = 'user_role'
    `);

    const auditType = auditCol[0]?.COLUMN_TYPE as string | undefined;
    if (!auditType?.includes("CLUB_OWNER")) {
      const auditValues = ensureEnumValue(
        parseEnumValues(auditType),
        "CLUB_OWNER"
      );
      await pool.execute(`
        ALTER TABLE audit_logs
        MODIFY COLUMN user_role ${formatEnumSql(auditValues)}
          NOT NULL COMMENT 'Роль пользователя на момент действия'
      `);
      console.log("✅ audit_logs.user_role: добавлен CLUB_OWNER");
    } else {
      console.log("⏭️  audit_logs.user_role уже содержит CLUB_OWNER");
    }
  }

  // --- Таблица clubs ---
  const [clubsTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clubs'
  `);

  if (clubsTables.length === 0) {
    await pool.execute(`
      CREATE TABLE clubs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL COMMENT 'Название клуба',
        logo_path VARCHAR(512) NULL COMMENT 'Относительный путь к логотипу',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_clubs_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Таблица clubs создана");
  } else {
    console.log("⏭️  Таблица clubs уже существует");
  }

  // --- club_owners ---
  const [ownersTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'club_owners'
  `);

  if (ownersTables.length === 0) {
    await pool.execute(`
      CREATE TABLE club_owners (
        club_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (club_id, user_id),
        UNIQUE KEY uq_club_owners_user (user_id),
        CONSTRAINT fk_club_owners_club
          FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        CONSTRAINT fk_club_owners_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Таблица club_owners создана");
  } else {
    console.log("⏭️  Таблица club_owners уже существует");
  }

  // --- club_members ---
  const [membersTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'club_members'
  `);

  if (membersTables.length === 0) {
    await pool.execute(`
      CREATE TABLE club_members (
        club_id INT NOT NULL,
        player_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (club_id, player_id),
        UNIQUE KEY uq_club_members_player (player_id),
        CONSTRAINT fk_club_members_club
          FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        CONSTRAINT fk_club_members_player
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Таблица club_members создана");
  } else {
    console.log("⏭️  Таблица club_members уже существует");
  }
}
