import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Добавляет users.roles (JSON массив ролей) для поддержки мульти-ролей.
 */
export async function up(pool: Pool): Promise<void> {
  const [rolesCol] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'roles'
  `);

  if (rolesCol.length === 0) {
    await pool.execute(`
      ALTER TABLE users
      ADD COLUMN roles JSON NULL
        COMMENT 'Массив ролей пользователя'
        AFTER role
    `);
    console.log("✅ users.roles добавлено");
  } else {
    console.log("⏭️  users.roles уже существует");
  }

  await pool.execute(`
    UPDATE users
    SET roles = JSON_ARRAY(role)
    WHERE roles IS NULL
      OR JSON_VALID(roles) = 0
      OR JSON_LENGTH(roles) = 0
  `);
  console.log("✅ users.roles заполнено из users.role");
}
