import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { calculateWins, calculateLoses } from "../services/winsLosesCalculator";

interface TableColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export const addWinsLosesColumns = async () => {
  try {
    console.log(
      "🔄 Миграция: Добавление столбцов wins и loses в tournament_results..."
    );

    // Проверяем структуру таблицы
    const [columns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );

    const hasWins = columns.some((col) => col.Field === "wins");
    const hasLoses = columns.some((col) => col.Field === "loses");

    if (hasWins && hasLoses) {
      console.log("✅ Столбцы wins и loses уже существуют");
      return;
    }

    // 1. Добавляем столбец wins если его нет
    if (!hasWins) {
      console.log("📝 Добавляем столбец wins...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN wins INT DEFAULT 0 AFTER qualifying_wins
      `);
    }

    // 2. Добавляем столбец loses если его нет
    if (!hasLoses) {
      console.log("📝 Добавляем столбец loses...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN loses INT DEFAULT 0 AFTER wins
      `);
    }

    // 3. Заполняем данные для существующих записей
    console.log("🔄 Заполняем данные wins и loses для существующих записей...");

    const [existingRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, points_reason, qualifying_wins FROM tournament_results"
    );

    console.log(`📊 Найдено ${existingRows.length} записей для обновления`);

    for (const row of existingRows) {
      const wins = calculateWins(row.points_reason, row.qualifying_wins || 0);
      const loses = calculateLoses(row.points_reason, row.qualifying_wins || 0);

      await pool.execute(
        "UPDATE tournament_results SET wins = ?, loses = ? WHERE id = ?",
        [wins, loses, row.id]
      );
    }

    console.log(`✅ Обновлено ${existingRows.length} записей`);

    // 4. Добавляем индексы для новых столбцов
    try {
      console.log("📊 Добавляем индексы для wins и loses...");

      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_wins (wins)
      `);

      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_loses (loses)
      `);
    } catch (error: any) {
      if (error.code === "ER_DUP_KEYNAME") {
        console.log("✅ Индексы уже существуют");
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
    const winsColumn = finalColumns.find((col) => col.Field === "wins");
    const losesColumn = finalColumns.find((col) => col.Field === "loses");

    if (winsColumn) {
      console.log(
        `  - wins: ${winsColumn.Type} ${
          winsColumn.Null === "NO" ? "NOT NULL" : "NULL"
        } DEFAULT ${winsColumn.Default}`
      );
    }
    if (losesColumn) {
      console.log(
        `  - loses: ${losesColumn.Type} ${
          losesColumn.Null === "NO" ? "NOT NULL" : "NULL"
        } DEFAULT ${losesColumn.Default}`
      );
    }
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    throw error;
  }
};
