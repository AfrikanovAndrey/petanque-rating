import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Роль PRESIDIUM_MEMBER (член президиума); признание результатов турнира для рейтинга (results_validated_at).
 */
export async function up(pool: Pool): Promise<void> {
  const [userCol] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
  `);

  const userType = userCol[0]?.COLUMN_TYPE as string | undefined;
  if (userType?.includes("PRESIDIUM_MEMBER")) {
    console.log("⏭️  users.role уже содержит PRESIDIUM_MEMBER");
  } else {
    await pool.execute(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('ADMIN', 'MANAGER', 'LICENSE_MANAGER', 'PRESIDIUM_MEMBER')
        NOT NULL DEFAULT 'MANAGER'
    `);
    console.log("✅ users.role: добавлен PRESIDIUM_MEMBER");
  }

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
    if (!auditType?.includes("PRESIDIUM_MEMBER")) {
      await pool.execute(`
        ALTER TABLE audit_logs
        MODIFY COLUMN user_role ENUM('ADMIN', 'MANAGER', 'LICENSE_MANAGER', 'PRESIDIUM_MEMBER')
          NOT NULL COMMENT 'Роль пользователя на момент действия'
      `);
      console.log("✅ audit_logs.user_role: добавлен PRESIDIUM_MEMBER");
    } else {
      console.log("⏭️  audit_logs.user_role уже содержит PRESIDIUM_MEMBER");
    }
  }

  const [tournamentCols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'results_validated_at'
  `);

  if (tournamentCols.length === 0) {
    await pool.execute(`
      ALTER TABLE tournaments
      ADD COLUMN results_validated_at TIMESTAMP NULL DEFAULT NULL
        COMMENT 'Признание президиумом: результаты учитываются в рейтинге'
        AFTER updated_at
    `);
    console.log("✅ tournaments.results_validated_at добавлено");

    await pool.execute(`
      UPDATE tournaments t
      SET t.results_validated_at = COALESCE(t.updated_at, t.created_at, NOW())
      WHERE EXISTS (
        SELECT 1 FROM tournament_results tr WHERE tr.tournament_id = t.id
      )
    `);
    console.log(
      "✅ Турниры с уже загруженными результатами помечены как признанные (обратная совместимость)",
    );
  } else {
    console.log("⏭️  tournaments.results_validated_at уже существует");
  }
}
