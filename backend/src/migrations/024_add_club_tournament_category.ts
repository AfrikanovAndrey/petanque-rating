import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";

/**
 * Миграция 024: категория турнира CLUB (клубный, без рейтинговых очков)
 */

export async function up(): Promise<void> {
  console.log("  🔍 Проверка категории CLUB в tournaments.category...");

  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tournaments'
      AND COLUMN_NAME = 'category'
  `);

  const columnType = columns[0]?.COLUMN_TYPE as string | undefined;
  if (columnType?.includes("'CLUB'")) {
    console.log("  ✅ Категория CLUB уже добавлена");
    return;
  }

  console.log("  📝 Добавление категории CLUB в tournaments.category...");
  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL', 'CLUB') NOT NULL DEFAULT 'REGIONAL'
  `);
  console.log("  ✅ Категория CLUB успешно добавлена");
}

export async function down(): Promise<void> {
  console.log("  📝 Откат категории CLUB в tournaments.category...");

  const [clubRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM tournaments WHERE category = 'CLUB'",
  );
  if ((clubRows[0]?.count as number) > 0) {
    throw new Error(
      "Невозможно откатить миграцию: есть турниры с категорией CLUB",
    );
  }

  await pool.execute(`
    ALTER TABLE tournaments
    MODIFY COLUMN category ENUM('FEDERAL', 'REGIONAL') NOT NULL DEFAULT 'REGIONAL'
  `);
  console.log("  ✅ Категория CLUB удалена");
}
