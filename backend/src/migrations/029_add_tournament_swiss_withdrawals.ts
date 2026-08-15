import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Снятия команд со швейцарки: не участвуют в паринге с указанного тура.
 * Формат: [{ team_id, from_round }]
 */

export async function up(pool: Pool): Promise<void> {
  const [cols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'swiss_withdrawals'
  `);

  if (cols.length > 0) {
    console.log("  ✅ tournaments.swiss_withdrawals уже существует");
    return;
  }

  console.log("  📝 Добавление tournaments.swiss_withdrawals...");
  await pool.execute(`
    ALTER TABLE tournaments
    ADD COLUMN swiss_withdrawals JSON NULL DEFAULT NULL
      COMMENT 'Снятия со швейцарки: [{team_id, from_round}]'
      AFTER swiss_seed
  `);
  console.log("  ✅ tournaments.swiss_withdrawals добавлено");
}

export async function down(pool: Pool): Promise<void> {
  const [cols] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'swiss_withdrawals'
  `);

  if (cols.length === 0) {
    console.log("  ⏭️  tournaments.swiss_withdrawals уже отсутствует");
    return;
  }

  await pool.execute(`ALTER TABLE tournaments DROP COLUMN swiss_withdrawals`);
  console.log("  ✅ tournaments.swiss_withdrawals удалён");
}
