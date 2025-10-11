import { Pool } from "mysql2/promise";

/**
 * Миграция: Добавление поля type в таблицу tournaments
 *
 * Добавляет колонку type с ENUM значениями для типа турнира:
 * - TRIPLETTE (триплеты)
 * - DOUBLETTE_MALE (дуплеты мужские)
 * - DOUBLETTE_FEMALE (дуплеты женские)
 * - DOUBLETTE_MIXT (дуплеты микст)
 * - TET-A-TET (теты)
 */

export async function up(pool: Pool): Promise<void> {
  console.log("  🔍 Проверка наличия поля type в tournaments...");

  // Проверяем, существует ли уже колонка type
  const [columns] = await pool.execute(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'type'
  `);

  if ((columns as any[]).length > 0) {
    console.log("  ✅ Поле type уже существует");
    return;
  }

  console.log("  📝 Добавление поля type в таблицу tournaments...");

  // Добавляем колонку type после name
  await pool.execute(`
    ALTER TABLE tournaments 
    ADD COLUMN type ENUM(
      'TRIPLETTE', 
      'DOUBLETTE_MALE', 
      'DOUBLETTE_FEMALE', 
      'DOUBLETTE_MIXT', 
      'TET-A-TET'
    ) NOT NULL
    AFTER name
  `);

  console.log("  ✅ Поле type успешно добавлено");
}

export async function down(pool: Pool): Promise<void> {
  console.log("  📝 Удаление поля type из таблицы tournaments...");

  // Проверяем, существует ли колонка type
  const [columns] = await pool.execute(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tournaments' 
      AND COLUMN_NAME = 'type'
  `);

  if ((columns as any[]).length === 0) {
    console.log("  ✅ Поле type уже удалено");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments 
    DROP COLUMN type
  `);

  console.log("  ✅ Поле type успешно удалено");
}
