import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Настройки проведения турнира: формат (группы / швейцарка), параметры и жеребьёвка.
 */
export async function up(pool: Pool): Promise<void> {
  const columnsToAdd: Array<{ name: string; ddl: string }> = [
    {
      name: "play_format",
      ddl: `ADD COLUMN play_format ENUM('GROUPS', 'SWISS') NULL DEFAULT NULL
        COMMENT 'Формат квалификации: группы или швейцарская система'
        AFTER regulations`,
    },
    {
      name: "group_size",
      ddl: `ADD COLUMN group_size TINYINT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Размер группы (4–6) для формата GROUPS'
        AFTER play_format`,
    },
    {
      name: "swiss_rounds",
      ddl: `ADD COLUMN swiss_rounds TINYINT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Количество туров швейцарской системы'
        AFTER group_size`,
    },
    {
      name: "tiebreaker_order",
      ddl: `ADD COLUMN tiebreaker_order JSON NULL DEFAULT NULL
        COMMENT 'Порядок дополнительных показателей для швейцарки'
        AFTER swiss_rounds`,
    },
    {
      name: "group_draw",
      ddl: `ADD COLUMN group_draw JSON NULL DEFAULT NULL
        COMMENT 'Результат жеребьёвки по группам: [{group_number, team_ids}]'
        AFTER tiebreaker_order`,
    },
  ];

  for (const column of columnsToAdd) {
    const [existing] = await pool.execute<RowDataPacket[]>(
      `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tournaments'
        AND COLUMN_NAME = ?
    `,
      [column.name],
    );

    if (existing.length > 0) {
      console.log(`⏭️  tournaments.${column.name} уже существует`);
      continue;
    }

    await pool.execute(`ALTER TABLE tournaments ${column.ddl}`);
    console.log(`✅ tournaments.${column.name} добавлено`);
  }
}
