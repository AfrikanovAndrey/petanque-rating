import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";

/**
 * Миграция 032: переименование категории турнира CLUB → NO_RATING в ENUM и данных.
 */

export async function up(): Promise<void> {
  console.log("  🔍 Проверка категории NO_RATING в tournaments.category...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'category'
  `);

  const columnType = columns[0]?.COLUMN_TYPE as string | undefined;
  if (columnType?.includes("'NO_RATING'")) {
    console.log("  ✅ Категория NO_RATING уже задана");
    return;
  }

  if (!columnType?.includes("'CLUB'")) {
    console.log("  ⏭️  Категория CLUB не найдена в ENUM, пропускаем");
    return;
  }

  console.log("  📝 Переименование CLUB → NO_RATING...");
  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL', 'CLUB', 'NO_RATING')
    NOT NULL DEFAULT 'REGIONAL'
  `);
  await pool.execute(`
    UPDATE tournaments SET category = 'NO_RATING' WHERE category = 'CLUB'
  `);
  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL', 'NO_RATING')
    NOT NULL DEFAULT 'REGIONAL'
  `);
  console.log("  ✅ Категория NO_RATING успешно применена");
}

export async function down(): Promise<void> {
  console.log("  📝 Откат NO_RATING → CLUB...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'category'
  `);

  const columnType = columns[0]?.COLUMN_TYPE as string | undefined;
  if (!columnType?.includes("'NO_RATING'")) {
    console.log("  ⏭️  NO_RATING не найдена, откат не требуется");
    return;
  }

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL', 'CLUB', 'NO_RATING')
    NOT NULL DEFAULT 'REGIONAL'
  `);
  await pool.execute(`
    UPDATE tournaments SET category = 'CLUB' WHERE category = 'NO_RATING'
  `);
  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL', 'CLUB')
    NOT NULL DEFAULT 'REGIONAL'
  `);
  console.log("  ✅ Откат на CLUB выполнен");
}
