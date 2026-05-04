import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Роль LICENSE_MANAGER в users.role и audit_logs.user_role.
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
  if (userType?.includes("LICENSE_MANAGER")) {
    console.log("⏭️  users.role уже содержит LICENSE_MANAGER");
  } else {
    await pool.execute(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('ADMIN', 'MANAGER', 'LICENSE_MANAGER')
        NOT NULL DEFAULT 'MANAGER'
    `);
    console.log("✅ users.role: добавлен LICENSE_MANAGER");
  }

  const [auditTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'audit_logs'
  `);

  if (auditTables.length === 0) {
    console.log("⏭️  Таблица audit_logs отсутствует, пропуск изменения user_role");
    return;
  }

  const [auditCol] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'audit_logs'
      AND COLUMN_NAME = 'user_role'
  `);

  const auditType = auditCol[0]?.COLUMN_TYPE as string | undefined;
  if (auditType?.includes("LICENSE_MANAGER")) {
    console.log("⏭️  audit_logs.user_role уже содержит LICENSE_MANAGER");
    return;
  }

  await pool.execute(`
    ALTER TABLE audit_logs
    MODIFY COLUMN user_role ENUM('ADMIN', 'MANAGER', 'LICENSE_MANAGER')
      NOT NULL COMMENT 'Роль пользователя на момент действия'
  `);
  console.log("✅ audit_logs.user_role: добавлен LICENSE_MANAGER");
}
