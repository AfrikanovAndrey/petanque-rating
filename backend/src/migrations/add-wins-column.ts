import { pool } from "../config/database";

/**
 * Миграция для добавления поля wins (количество побед) в таблицу tournament_results
 */
const addWinsColumnMigration = async () => {
  try {
    console.log(
      "🔍 Проверка существования столбца wins в таблице tournament_results..."
    );

    // Проверяем существование столбца wins
    const [columns] = await pool.execute<any[]>("DESCRIBE tournament_results");

    const winsColumnExists = columns.some((col: any) => col.Field === "wins");

    if (!winsColumnExists) {
      console.log("📝 Добавление столбца wins...");

      // Добавляем столбец wins
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN wins INT DEFAULT 0 AFTER cup
      `);

      // Добавляем индекс для wins
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_wins (wins)
      `);

      console.log(
        "✅ Столбец wins успешно добавлен в таблицу tournament_results"
      );
    } else {
      console.log("✓ Столбец wins уже существует в таблице tournament_results");
    }

    // Проверяем окончательную структуру
    const [finalColumns] = await pool.execute<any[]>(
      "DESCRIBE tournament_results"
    );

    console.log("📋 Текущая структура таблицы tournament_results:");
    finalColumns.forEach((col: any) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${
          col.Null === "YES" ? "NULL" : "NOT NULL"
        } ${col.Default ? `DEFAULT ${col.Default}` : ""}`
      );
    });
  } catch (error) {
    console.error("❌ Ошибка при выполнении миграции для столбца wins:", error);
    throw error;
  }
};

export const runAddWinsColumnMigration = addWinsColumnMigration;
