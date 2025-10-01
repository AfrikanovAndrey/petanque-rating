import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface TableColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export const renameWinsToQualifyingWins = async () => {
  try {
    console.log(
      "🔄 Миграция: Переименование столбца wins в qualifying_wins..."
    );

    // Проверяем структуру таблицы
    const [columns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );

    const hasWins = columns.some((col) => col.Field === "wins");
    const hasQualifyingWins = columns.some(
      (col) => col.Field === "qualifying_wins"
    );

    if (!hasWins && hasQualifyingWins) {
      console.log("✅ Миграция уже выполнена");
      return;
    }

    if (!hasWins) {
      console.log("❌ Столбец wins не найден");
      return;
    }

    if (hasQualifyingWins) {
      console.log("❌ Столбец qualifying_wins уже существует");
      return;
    }

    // 1. Переименовываем столбец wins в qualifying_wins
    console.log("📝 Переименовываем столбец wins в qualifying_wins...");
    await pool.execute(`
      ALTER TABLE tournament_results 
      CHANGE COLUMN wins qualifying_wins INT DEFAULT 0
    `);

    // 2. Проверяем и пересоздаем индекс если нужно
    try {
      console.log("🗑️ Удаляем старый индекс idx_wins если существует...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        DROP INDEX IF EXISTS idx_wins
      `);
    } catch (error: any) {
      // Игнорируем ошибку если индекс не существует
      console.log("✅ Индекс idx_wins не существовал");
    }

    try {
      console.log("📊 Создаём новый индекс idx_qualifying_wins...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_qualifying_wins (qualifying_wins)
      `);
    } catch (error: any) {
      if (error.code === "ER_DUP_KEYNAME") {
        console.log("✅ Индекс idx_qualifying_wins уже существует");
      } else {
        throw error;
      }
    }

    console.log("✅ Миграция успешно завершена!");

    // Показываем итоговую структуру
    const [finalColumns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );
    console.log("📋 Обновлённая структура таблицы tournament_results:");
    const qualifyingWinsColumn = finalColumns.find(
      (col) => col.Field === "qualifying_wins"
    );
    if (qualifyingWinsColumn) {
      console.log(
        `  - qualifying_wins: ${qualifyingWinsColumn.Type} ${
          qualifyingWinsColumn.Null === "NO" ? "NOT NULL" : "NULL"
        } DEFAULT ${qualifyingWinsColumn.Default}`
      );
    }
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    throw error;
  }
};
