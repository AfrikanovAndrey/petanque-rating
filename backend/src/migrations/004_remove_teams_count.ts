import { Pool } from "mysql2/promise";

/**
 * Миграция: Удаление колонки teams_count из таблицы tournaments
 * Количество команд будет рассчитываться автоматически из таблицы tournament_results
 */

export async function up(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка teams_count
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tournaments' 
        AND COLUMN_NAME = 'teams_count'
    `);

    // Если колонка не существует, пропускаем миграцию
    if ((columns as any[]).length === 0) {
      console.log("✓ Миграция 004: колонка teams_count уже удалена");
      return;
    }

    // Удаляем колонку teams_count
    await pool.execute(`
      ALTER TABLE tournaments 
      DROP COLUMN teams_count
    `);

    console.log(
      "✓ Миграция 004: удалена колонка teams_count из таблицы tournaments"
    );
  } catch (error) {
    console.error("✗ Ошибка миграции 004:", error);
    throw error;
  }
}

export async function down(pool: Pool): Promise<void> {
  try {
    // Проверяем, существует ли колонка teams_count
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tournaments' 
        AND COLUMN_NAME = 'teams_count'
    `);

    // Если колонка уже существует, пропускаем откат
    if ((columns as any[]).length > 0) {
      console.log("✓ Откат миграции 004: колонка teams_count уже существует");
      return;
    }

    // Восстанавливаем колонку teams_count
    await pool.execute(`
      ALTER TABLE tournaments 
      ADD COLUMN teams_count INT NOT NULL DEFAULT 0 AFTER category
    `);

    // Рассчитываем и обновляем значения teams_count для существующих турниров
    await pool.execute(`
      UPDATE tournaments t
      SET teams_count = (
        SELECT COUNT(DISTINCT tr.team_id)
        FROM tournament_results tr
        WHERE tr.tournament_id = t.id
      )
    `);

    console.log("✓ Откат миграции 004: восстановлена колонка teams_count");
  } catch (error) {
    console.error("✗ Ошибка отката миграции 004:", error);
    throw error;
  }
}
